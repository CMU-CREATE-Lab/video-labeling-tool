#TODO: force a user to go to the tutorial if doing the batches wrong for too many times, mark the user as spam if continue to do so
#TODO: how to promote the client to a different rank when it is changed? invalidate the user token? (need to add a table to record the promotion history)
#      (need to encode client type in the user token, and check if this matches the database record)
#      (for a user that did not login via google, always treat them as laypeople)
#TODO: add the last_queried_time to video and query the ones with last_queried_time <= current_time - lock_time
#TODO: refactor code based on https://codeburst.io/jwt-authorization-in-flask-c63c1acf4eeb

from flask import Flask, render_template, jsonify, request, abort, g, make_response
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_marshmallow import Marshmallow
from sqlalchemy import func, and_, or_, not_, MetaData
import numpy as np
import time
import jwt
import uuid
from pathlib import Path
from collections import Counter
from google.oauth2 import id_token
from google.auth.transport import requests as g_requests
from flask_migrate import Migrate
import logging
import logging.handlers
import os
import json
from urllib.parse import parse_qs
from random import shuffle

"""
Config Parameters
"""
video_url_root = "https://thumbnails-v2.createlab.org/thumbnail"
google_signin_client_id = Path("../data/google_signin_client_id").read_text().strip()
private_key = Path("../data/private_key").read_text().strip()
batch_size = 16 # the number of videos for each batch
video_jwt_nbf_duration = 5 # cooldown duration (seconds) before the jwt can be accepted (to prevent spam)
max_page_size = 1000 # the max page size allowed for getting videos
gold_standard_in_batch = 4 # the number of gold standard videos added the batch for citizens (not reseacher)

"""
Initialize the application
"""
app = Flask(__name__)

"""
Setup cors for development
"""
if app.config["ENV"] == "development":
    cors = CORS(app, resources={r"/api/*": {"origins": "*"}})

"""
Setup custom logger for production
"""
if app.config["ENV"] == "production":
    custom_log_path = "../log/app.log"
    dir_name = os.path.dirname(custom_log_path)
    if dir_name != "" and not os.path.exists(dir_name):
        os.makedirs(dir_name) # create directory if it does not exist
    formatter = logging.Formatter("[%(asctime)s] [%(ip)s] [%(agent)s] [%(path)s] [%(method)s] %(levelname)s:\n\n\t%(message)s\n")
    handler = logging.handlers.RotatingFileHandler(custom_log_path, mode="a", maxBytes=100000000, backupCount=200)
    handler.setFormatter(formatter)
    logger = logging.getLogger("video_labeling_tool")
    logger.setLevel(logging.INFO)
    for hdlr in logger.handlers[:]:
        logger.removeHandler(hdlr) # remove old handlers
    logger.addHandler(handler)

"""
Database
"""
app.config["SQLALCHEMY_DATABASE_URI"] = Path("../data/db_url").read_text().strip()
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s"
}
db = SQLAlchemy(app, metadata=MetaData(naming_convention=convention))
migrate = Migrate(app, db)
ma = Marshmallow(app)

"""
Return the current epochtime in seconds
"""
def get_current_time():
    return round(time.time())

"""
The class for the video table
"""
class Video(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    # The file name stored in the disk
    file_name = db.Column(db.String(255), unique=True, nullable=False)
    # The starting and ending epochtime of the video
    start_time = db.Column(db.Integer, nullable=False) 
    end_time = db.Column(db.Integer, nullable=False)
    # Width, height, and scale of the video
    # Scale is used for computing a point in the video relative to the large panorama
    # For example, a point (x, y) on the video has a global coordinate (left + x*scale, top + y*scale)
    width = db.Column(db.Integer, nullable=False)
    height = db.Column(db.Integer, nullable=False)
    scale = db.Column(db.Float, nullable=False)
    # For the global large panorama, the origin (0, 0) is at the top-right corner
    # The top-left point coordinate (x, y) of the video relative to the large panorama
    left = db.Column(db.Integer, nullable=False)
    top = db.Column(db.Integer, nullable=False)
    # The thumbnail url query string part
    url_part = db.Column(db.String(768), unique=True, nullable=False)
    # The state of the label (also enable database indexing on this column for fast lookup)
    # (label_state_admin is for admin researcher, client type 0)
    label_state = db.Column(db.Integer, nullable=False, default=-1, index=True)
    label_state_admin = db.Column(db.Integer, nullable=False, default=-1, index=True)
    # Relationships
    label = db.relationship("Label", backref=db.backref("video", lazy=True), lazy=True)
    view = db.relationship("View", backref=db.backref("video", lazy=True), lazy=True)

    def __repr__(self):
        return ("<Video id=%r file_name=%r start_time=%r end_time=%r width=%r height=%r scale=%r left=%r, top=%r, url_part=%r label_state=%r, label_state_admin=%r>") % (self.id, self.file_name, self.start_time, self.end_time, self.width, self.height, self.scale, self.left, self.top, self.url_part, self.label_state, self.label_state_admin)

"""
The class for the user table
"""
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    # The client id of the user, provided by the client using Google Analytics (GA)
    # If GA fails to give the id, a random string is generated by the client instead
    # If the user signed in by using a google account, the client id will be the google id
    client_id = db.Column(db.String(255), unique=True, nullable=False)
    # The current type of the user (the history of client type changes is in the Connection table)
    # 0: researcher (admin)
    # 1: expert
    # 2: amateur
    # 3: laypeople
    # -1: black listed
    client_type = db.Column(db.Integer, nullable=False, default=3)
    # The epochtime (in seconds) when the user was added
    register_time = db.Column(db.Integer, nullable=False, default=get_current_time)
    # The score that the user obtained so far (number of labeled videos)
    score = db.Column(db.Integer, nullable=False, default=0)
    # Relationships
    label = db.relationship("Label", backref=db.backref("user", lazy=True), lazy=True)
    connection = db.relationship("Connection", backref=db.backref("user", lazy=True), lazy=True)

    def __repr__(self):
        return ("<User id=%r client_id=%r client_type=%r register_time=%r score=%r>") % (self.id, self.client_id, self.client_type, self.register_time, self.score)

"""
The class for the label history table
"""
class Label(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    # The video id in the Video table
    video_id = db.Column(db.Integer, db.ForeignKey("video.id"), nullable=False)
    # The user-provided label for the video
    label = db.Column(db.Integer, nullable=False)
    # The epochtime (in seconds) for the label record
    time = db.Column(db.Integer, nullable=False, default=get_current_time)
    # The user id in the User table (this information is duplicated in the batch->connnection, for fast query)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    # The batch id in the Batch table (null means that an admin changed the label)
    batch_id = db.Column(db.Integer, db.ForeignKey("batch.id"))

    def __repr__(self):
        return ("<Label id=%r video_id=%r label=%r time=%r user_id=%r batch_id=%r>") % (self.id, self.video_id, self.label, self.time, self.user_id, self.batch_id)

"""
The class for the user connection history table (for tracking user sessions)
"""
class Connection(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    # The epochtime (in seconds) when the user connects to the server
    time = db.Column(db.Integer, nullable=False, default=get_current_time)
    # The current client type of the user (client type may change over time)
    client_type = db.Column(db.Integer, nullable=False)
    # The user id in the User table (the user who connected to the server)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    # Current score of the user
    user_score = db.Column(db.Integer) # null means no information, added on 4/26/2019
    # Relationships
    batch = db.relationship("Batch", backref=db.backref("connection", lazy=True), lazy=True)
    view = db.relationship("View", backref=db.backref("connection", lazy=True), lazy=True)

    def __repr__(self):
        return ("<Connection id=%r time=%r client_type=%r user_id=%r user_score=%r>") % (self.id, self.time, self.client_type, self.user_id, self.user_score)

"""
The class for the issued video batch history table (for tracking video batches)
"""
class Batch(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    # The epochtime (in seconds) when the client requested a batch and returned the batch
    request_time = db.Column(db.Integer, nullable=False, default=get_current_time)
    return_time = db.Column(db.Integer)
    # The connection id in the Connection table
    connection_id = db.Column(db.Integer, db.ForeignKey("connection.id"))
    # The score that the user obtained in this Batch (number of labeled videos)
    score = db.Column(db.Integer) # null means no data is returned by the user or the user is a reseacher
    # The number of gold standards and unlabeled videos in this batch
    num_unlabeled = db.Column(db.Integer, nullable=False, default=0)
    num_gold_standard = db.Column(db.Integer, nullable=False, default=0)
    # Current score of the user
    user_score = db.Column(db.Integer) # null means no information, added on 4/26/2019
    # Relationships
    label = db.relationship("Label", backref=db.backref("batch", lazy=True), lazy=True)

    def __repr__(self):
        return ("<Batch id=%r request_time=%r return_time=%r connection_id=%r score=%r num_unlabeled=%r num_gold_standard=%r user_score=%r>") % (self.id, self.request_time, self.return_time, self.connection_id, self.score, self.num_unlabeled, self.num_gold_standard, self.user_score)

"""
The table for tracking viewed videos
"""
class View(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    # The connection id in the Connection table
    connection_id = db.Column(db.Integer, db.ForeignKey("connection.id"), nullable=False)
    # The video id in the Video table
    video_id = db.Column(db.Integer, db.ForeignKey("video.id"), nullable=False)
    # The query type to get the videos
    # 0: query by label state
    # 1: query by user id
    query_type = db.Column(db.Integer, nullable=False)

    def __repr__(self):
        return ("<View id=%r connection_id=%r video_id=%r query_type=%r>") % (self.id, self.connection_id, self.video_id, self.query_type)

"""
The schema for the video table, used for jsonify
"""
class VideoSchema(ma.ModelSchema):
    class Meta:
        model = Video # the class for the model
        fields = ("id", "url_part", "label_state") # fields to expose
video_schema = VideoSchema()
videos_schema = VideoSchema(many=True)

"""
The schema for the video table, used for jsonify without label_state
"""
class VideoSchemaIsAdmin(ma.ModelSchema):
    class Meta:
        model = Video # the class for the model
        fields = ("id", "url_part", "label_state", "label_state_admin", "start_time", "file_name") # fields to expose
video_schema_is_admin = VideoSchemaIsAdmin()
videos_schema_is_admin = VideoSchemaIsAdmin(many=True)

"""
The class for handling errors, such as a bad request
"""
class InvalidUsage(Exception):
    def __init__(self, message, status_code=400, payload=None):
        Exception.__init__(self)
        self.message = message
        if status_code is not None:
            self.status_code = status_code
        self.payload = payload

    def to_dict(self):
        rv = dict(self.payload or ())
        rv["message"] = self.message
        return rv

"""
Error handler
"""
@app.errorhandler(InvalidUsage)
def handle_invalid_usage(error):
    log_error("<InvalidUsage status_code=%r message='%s'>" % (error.status_code, error.message))
    response = jsonify(error.to_dict())
    response.status_code = error.status_code
    return response

"""
For the index page
"""
@app.route("/")
def index():
    return "Hello World!"

"""
For the client to login
"""
@app.route("/api/v1/login", methods=["POST"])
def login():
    client_id = None
    # Get client id
    if request.json is not None:
        if "google_id_token" in request.json:
            google_id_token = request.json["google_id_token"]
            id_info = id_token.verify_oauth2_token(google_id_token, g_requests.Request(), google_signin_client_id)
            if id_info["iss"] not in ["accounts.google.com", "https://accounts.google.com"]:
                e = InvalidUsage("Wrong token issuer", status_code=401)
                return handle_invalid_usage(e)
            client_id = "google.%s" % id_info["sub"]
        else:
            if "client_id" in request.json:
                client_id = request.json["client_id"]
    # Get user id by client id, and issued an user jwt
    if client_id is not None:
        user_token = get_user_token_by_client_id(client_id)
        if user_token is None:
            e = InvalidUsage("Permission denied", status_code=403)
            return handle_invalid_usage(e)
        else:
            return_json = {"user_token": user_token}
            return jsonify(return_json)
    else:
        e = InvalidUsage("Missing field: google_id_token or client_id", status_code=400)
        return handle_invalid_usage(e)

"""
For the client to get a batch of video clips
"""
@app.route("/api/v1/get_batch", methods=["POST"])
def get_batch():
    if request.json is None:
        e = InvalidUsage("Missing json", status_code=400)
        return handle_invalid_usage(e)
    if "user_token" not in request.json:
        e = InvalidUsage("Missing field: user_token", status_code=400)
        return handle_invalid_usage(e)
    # Decode user jwt
    try:
        user_jwt = decode_jwt(request.json["user_token"])
    except jwt.InvalidSignatureError as ex:
        e = InvalidUsage(ex.args[0], status_code=401)
        return handle_invalid_usage(e)
    except Exception as ex:
        e = InvalidUsage(ex.args[0], status_code=401)
        return handle_invalid_usage(e)
    # Query videos (active learning or random sampling)
    is_admin = True if user_jwt["client_type"] == 0 else False
    video_batch = query_video_batch(user_jwt["user_id"], use_admin_label_state=is_admin)
    if len(video_batch) < batch_size:
        return make_response("", 204)
    else:
        if is_admin:
            batch = add_batch(num_gold_standard=0, num_unlabeled=batch_size) # no gold standard for researcher
        else:
            batch = add_batch(num_gold_standard=gold_standard_in_batch, num_unlabeled=batch_size-gold_standard_in_batch)
        return jsonify_videos(video_batch, sign=True, batch_id=batch.id, user_id=user_jwt["user_id"])

"""
For the client to send labels of a batch back to the server
"""
@app.route("/api/v1/send_batch", methods=["POST"])
def send_batch():
    if request.json is None:
        e = InvalidUsage("Missing json", status_code=400)
        return handle_invalid_usage(e)
    if "data" not in request.json:
        e = InvalidUsage("Missing field: data", status_code=400)
        return handle_invalid_usage(e)
    if "user_token" not in request.json:
        e = InvalidUsage("Missing field: user_token", status_code=400)
        return handle_invalid_usage(e)
    if "video_token" not in request.json:
        e = InvalidUsage("Missing field: video_token", status_code=400)
        return handle_invalid_usage(e)
    # Decode user and video jwt
    try:
        video_jwt = decode_jwt(request.json["video_token"])
        user_jwt = decode_jwt(request.json["user_token"])
    except jwt.InvalidSignatureError as ex:
        e = InvalidUsage(ex.args[0], status_code=401)
        return handle_invalid_usage(e)
    except Exception as ex:
        e = InvalidUsage(ex.args[0], status_code=401)
        return handle_invalid_usage(e)
    # Verify video id list and user_id
    labels = request.json["data"]
    original_v = video_jwt["video_id_list"]
    returned_v = [v["video_id"] for v in labels]
    if Counter(original_v) != Counter(returned_v) or video_jwt["user_id"] != user_jwt["user_id"]:
        e = InvalidUsage("Signature of the video batch is not valid", status_code=401)
        return handle_invalid_usage(e)
    # Update database
    try:
        score = update_labels(labels, user_jwt["user_id"], user_jwt["connection_id"], video_jwt["batch_id"], user_jwt["client_type"])
        return_json = {"data": {"score": score}}
        return jsonify(return_json)
    except Exception as ex:
        e = InvalidUsage(ex.args[0], status_code=400)
        return handle_invalid_usage(e)

"""
Set video labels to positive, negative, or gold standard (only researcher can use this call)
"""
@app.route("/api/v1/set_label_state", methods=["POST"])
def set_label_state():
    if request.json is None:
        e = InvalidUsage("Missing json", status_code=400)
        return handle_invalid_usage(e)
    if "data" not in request.json:
        e = InvalidUsage("Missing field: data", status_code=400)
        return handle_invalid_usage(e)
    if "user_token" not in request.json:
        e = InvalidUsage("Missing field: user_token", status_code=400)
        return handle_invalid_usage(e)
    # Decode user jwt
    try:
        user_jwt = decode_jwt(request.json["user_token"])
    except jwt.InvalidSignatureError as ex:
        e = InvalidUsage(ex.args[0], status_code=401)
        return handle_invalid_usage(e)
    except Exception as ex:
        e = InvalidUsage(ex.args[0], status_code=401)
        return handle_invalid_usage(e)
    # Verify if the user is a researcher
    if user_jwt["client_type"] != 0:
        e = InvalidUsage("Permission denied", status_code=403)
        return handle_invalid_usage(e)
    # Update database
    try:
        update_labels(request.json["data"], user_jwt["user_id"], None, None, user_jwt["client_type"])
        return make_response("", 204)
    except Exception as ex:
        e = InvalidUsage(ex.args[0], status_code=400)
        return handle_invalid_usage(e)

"""
Get videos with positive labels
"""
pos_labels = [0b10111, 0b1111, 0b10011]
@app.route("/api/v1/get_pos_labels", methods=["GET", "POST"])
def get_pos_labels():
    return get_video_labels(pos_labels, allow_user_id=True)

"""
Get videos with negative labels
"""
neg_labels = [0b10000, 0b1100, 0b10100]
@app.route("/api/v1/get_neg_labels", methods=["GET", "POST"])
def get_neg_labels():
    return get_video_labels(neg_labels)

"""
Get videos with positive gold standard labels (only admin can use this call)
Gold standard labels will only be set by researchers
"""
pos_gold_labels = [0b101111]
@app.route("/api/v1/get_pos_gold_labels", methods=["POST"])
def get_pos_gold_labels():
    return get_video_labels(pos_gold_labels, only_admin=True, use_admin_label_state=True)

"""
Get videos with negative gold standard labels (only admin can use this call)
Gold standard labels will only be set by researchers
"""
neg_gold_labels = [0b100000]
@app.route("/api/v1/get_neg_gold_labels", methods=["POST"])
def get_neg_gold_labels():
    return get_video_labels(neg_gold_labels, only_admin=True, use_admin_label_state=True)

"""
Get videos with positive labels, exclude gold standard labels (only admin can use this call)
"""
@app.route("/api/v1/get_pos_labels_by_researcher", methods=["GET", "POST"])
def get_pos_labels_by_researcher():
    return get_video_labels(pos_labels, only_admin=True, use_admin_label_state=True)

"""
Get videos with negative labels, exclude gold standard labels (only admin can use this call)
"""
@app.route("/api/v1/get_neg_labels_by_researcher", methods=["GET", "POST"])
def get_neg_labels_by_researcher():
    return get_video_labels(neg_labels, only_admin=True, use_admin_label_state=True)

"""
Get videos with insufficient user-provided labels (only admin can use this call)
Partial labels will only be set by citizens
"""
partial_labels = [0b11, 0b100, 0b101] # Do not include label state -1 because of too many unlabeled videos
@app.route("/api/v1/get_partial_labels", methods=["POST"])
def get_partial_labels():
    return get_video_labels(partial_labels, only_admin=True)

"""
Get videos that were discarded (only admin can use this call)
Bad labels will only be set by researchers
"""
bad_labels = [-2]
@app.route("/api/v1/get_bad_labels", methods=["POST"])
def get_bad_labels():
    return get_video_labels(bad_labels, only_admin=True, use_admin_label_state=True)

"""
Get all data (only admin can use this call)
"""
@app.route("/api/v1/get_all_labels", methods=["POST"])
def get_all_labels():
    return get_video_labels(None, only_admin=True, use_admin_label_state=True)

"""
Get video labels
"""
def get_video_labels(labels, allow_user_id=False, only_admin=False, use_admin_label_state=False):
    user_id = request.args.get("user_id") if allow_user_id else None
    page_number = request.args.get("pageNumber", 1, type=int)
    page_size = request.args.get("pageSize", 16, type=int)
    user_jwt = None
    data = request.get_data()
    if data is not None:
        qs = parse_qs(data.decode("utf8"))
        if "user_token" in qs:
            # Decode user jwt
            try:
                user_jwt = decode_jwt(qs["user_token"][0])
            except jwt.InvalidSignatureError as ex:
                e = InvalidUsage(ex.args[0], status_code=401)
                return handle_invalid_usage(e)
            except Exception as ex:
                e = InvalidUsage(ex.args[0], status_code=401)
                return handle_invalid_usage(e)
        if "pageNumber" in qs:
            page_number = int(qs["pageNumber"][0])
        if "pageSize" in qs:
            page_size = int(qs["pageSize"][0])
    if only_admin:
        # Verify if user_token is returned
        if user_jwt is None:
            e = InvalidUsage("Missing fields: user_token", status_code=400)
            return handle_invalid_usage(e)
        # Verify if the user is researcher or expert (they are considered admins in this case)
        if user_jwt["client_type"] != 0 and user_jwt["client_type"] != 1:
            e = InvalidUsage("Permission denied", status_code=403)
            return handle_invalid_usage(e)
    is_admin = True if user_jwt is not None and (user_jwt["client_type"] == 0 or user_jwt["client_type"] == 1) else False
    if user_id is None:
        if labels is None and is_admin:
            return jsonify_videos(Video.query.all(), is_admin=True)
        else:
            q = get_video_query(labels, page_number, page_size, use_admin_label_state)
            if user_jwt["client_type"] != 0: # ignore researcher
                add_video_views(q.items, user_jwt, query_type=0)
            return jsonify_videos(q.items, total=q.total, is_admin=is_admin)
    else:
        q = get_pos_video_query_by_user_id(user_id, page_number, page_size, user_jwt["client_type"])
        if user_jwt["client_type"] != 0: # ignore researcher
            add_video_views(q.items, user_jwt, query_type=1)
        return jsonify_videos(q.items, total=q.total, is_admin=is_admin)

"""
Update the View table
"""
def add_video_views(videos, user_jwt, query_type=None):
    if query_type is None: return
    for v in videos:
        add_view(connection_id=user_jwt["connection_id"], video_id=v.id, query_type=query_type)

"""
Get video query from the database
"""
def get_video_query(labels, page_number, page_size, use_admin_label_state):
    page_size = max_page_size if page_size > max_page_size else page_size
    q = None
    if len(labels) > 1:
        if use_admin_label_state:
            q = Video.query.filter(Video.label_state_admin.in_(labels))
        else:
            # Exclude gold standards for normal request
            q = Video.query.filter(and_(Video.label_state.in_(labels), Video.label_state_admin.notin_((0b101111, 0b100000))))
    if len(labels) == 1:
        if use_admin_label_state:
            q = Video.query.filter(Video.label_state_admin==labels[0])
        else:
            # Exclude gold standards for normal request
            q = Video.query.filter(and_(Video.label_state==labels[0], Video.label_state_admin.notin_((0b101111, 0b100000))))
    if page_number is not None and page_size is not None:
        q = q.paginate(page_number, page_size, False)
    return q

"""
Get video query from the database by user id
(exclude gold standards)
"""
def get_pos_video_query_by_user_id(user_id, page_number, page_size, client_type):
    page_size = max_page_size if page_size > max_page_size else page_size
    if client_type == 0: # researcher
        q = Label.query.filter(and_(Label.user_id==user_id, Label.label.in_([1, 0b10111, 0b1111, 0b10011])))
    else:
        q = Label.query.filter(and_(Label.user_id==user_id, Label.label==1))
    return q.from_self(Video).join(Video).filter(Video.label_state_admin!=0b101111).paginate(page_number, page_size, False)

"""
Jsonify videos
user_id: a part of the digital signature
sign: require digital signature or not
"""
def jsonify_videos(videos, sign=False, batch_id=None, total=None, is_admin=False, user_id=None):
    if len(videos) == 0: return make_response("", 204)
    if is_admin:
        videos_json, errors = videos_schema_is_admin.dump(videos)
    else:
        videos_json, errors = videos_schema.dump(videos)
    if sign:
        video_id_list = []
    for i in range(len(videos_json)):
        videos_json[i]["url_root"] = video_url_root
        if sign:
            video_id_list.append(videos_json[i]["id"])
    return_json = {"data": videos_json}
    if sign:
        return_json["video_token"] = encode_video_jwt(video_id_list=video_id_list, batch_id=batch_id, user_id=user_id)
    if total is not None:
        return_json["total"] = total
    return jsonify(return_json)

"""
Compute the score of a video batch
"""
def compute_video_batch_score(video_batch_hashed, labels):
    score = 0
    correct_labeled_gold_standards = 0
    for v in labels:
        video = video_batch_hashed[v["video_id"]]
        label_state_admin = video.label_state_admin
        s = v["label"]
        if label_state_admin == 0b101111: # gold positive
            if s == 1:
                correct_labeled_gold_standards += 1
        elif label_state_admin == 0b100000: # gold negative
            if s == 0:
                correct_labeled_gold_standards += 1
        else:
            score += 1
    if correct_labeled_gold_standards < gold_standard_in_batch:
        return 0
    else:
        return score

"""
Update the Video table when a new label is added, return the score of the batch
"""
def update_labels(labels, user_id, connection_id, batch_id, client_type):
    if len(labels) == 0: return
    # Search the video batch and hash videos by video_id
    video_batch = Video.query.filter(Video.id.in_((v["video_id"] for v in labels))).all()
    video_batch_hashed = {}
    for video in video_batch:
        video_batch_hashed[video.id] = video
    # Find the user
    user = User.query.filter(User.id==user_id).first()
    # Update batch data
    batch_score = None
    if batch_id is not None and connection_id is not None:
        batch = Batch.query.filter(Batch.id==batch_id).first()
        batch.return_time = get_current_time()
        batch.connection_id = connection_id
        if client_type != 0: # do not update the score for reseacher
            batch_score = compute_video_batch_score(video_batch_hashed, labels)
            batch.score = batch_score
            batch.user_score = user.score
        log("Update batch: %r" % batch)
    # Add labeling history and update the video label state
    # If the batch score is 0, do not update the label history since this batch is not reliable
    user_score = None
    if batch_score != 0:
        # Update user score
        if client_type != 0: # do not update the score for reseacher
            user_score = user.score + batch_score
            user.score = user_score
            log("Update user: %r" % user)
        # Update labels
        for v in labels:
            v["user_id"] = user_id
            v["batch_id"] = batch_id
            add_label(**v)
            video = video_batch_hashed[v["video_id"]]
            if client_type == 0: # admin researcher
                next_s = label_state_machine(video.label_state_admin, v["label"], client_type)
            else: # normal user
                next_s = label_state_machine(video.label_state, v["label"], client_type)
            if next_s is not None:
                if client_type == 0: # admin researcher
                    # Researchers should not override the labels provided by normal users
                    # Because we need to compare the reliability of the labels provided by normal users
                    video.label_state_admin = next_s
                else: # normal user
                    video.label_state = next_s
                log("Update video: %r" % video)
            else:
                log_warning("No next state for video: %r" % video)
    # Update database
    update_db()
    return {"batch": batch_score, "user": user_score}

"""
A finite state machine to infer the new label state based on current label state and some inputs
Return None for wrong inputs
The first bit from the left indicates if the data is useful (1: useful, 0: discarded)
The second bit from the left indicates if the data has discord (1: has discord, 0: no discord)
The rest of the bits indicates positve (1) or negative (0) labels
For example, if a layperson labels 0, will attach "0" to the current state
Another example, if an expert labels 1, will attach "11" to the current state
    0b101111 (47) : pos (gold standard), by reseacher [both INITIAL and TERMINAL STATE]
    0b100000 (32) : neg (gold standard), by reseacher [both INITIAL and TERMINAL STATE]
    0b10111 (23) : strong pos (no discord, by 1 laypeople/amateurs + 1 expert) [TERMINAL STATE]
    0b10100 (20) : weak neg (no discord, by 1 laypeople/amateurs + 1 expert) [TERMINAL STATE]
    0b10011 (19) : weak pos (no discord, by 1 laypeople/amateurs + 1 expert) [TERMINAL STATE]
    0b10000 (16) : strong neg (no discord, by 1 laypeople/amateurs + 1 expert) [TERMINAL STATE]
    0b1011 : strong pos (no discord, by 2 laypeople/amateurs, or 1 expert/researcher) -> 0b10111
    0b1001 -> 0b11
    0b1010 -> 0b11
    0b1000 : strong neg (no discord, by 2 laypeople/amateurs, or 1 expert) -> 0b10000
    0b1111 (15) : medium pos (has discord, verified by 1 expert) [TERMINAL STATE]
    0b1100 (12) : medium neg (has discord, verified by 1 expert) [TERMINAL STATE]
    0b111 : weak pos (has discord, verified by 1 layperson/amateur) -> 0b10011
    0b110 : weak neg (has discord, verified by 1 layperson/amateur) -> 0b10100
    0b101 (5) : maybe pos (by 1 layperson/amateur) [TRANSITIONAL STATE]
    0b100 (4) : maybe neg (by 1 layperson/amateur) [TRANSITIONAL STATE]
    0b11 (3) : no data, has discord [TRANSITIONAL STATE]
    0b10 -> -1
    -1 : no data, no discord [INITIAL state]
    -2 : discarded data, by researchers [both INITIAL and TERMINAL STATE]
Notation "->" means that the state is merged to another state
For consistency, we always use -1 to indicate 0b10, the initial state that has no data
"""
def label_state_machine(s, label, client_type):
    next_s = None
    # Researchers
    if client_type == 0:
        if label == 0b10111: next_s = 0b10111 # strong pos
        elif label == 0b10000: next_s = 0b10000 # strong neg
        elif label == 0b101111: next_s = 0b101111 # pos gold standard
        elif label == 0b100000: next_s = 0b100000 # neg gold standard
        elif label == 1: next_s = 0b10111 # strong pos
        elif label == 0: next_s = 0b10000 # strong neg
        elif label == -2: next_s = -2 # discard label
        elif label == -1: next_s = -1 # reset label
    else:
        # Sanity check, can only use undefined labels (not terminal state)
        undefined_labels = [0b101, 0b100, 0b11, -1]
        if s not in undefined_labels: return None
    # Experts, amateurs, and laypeople
    if client_type == 1: # experts
        if s == -1: # 0b10 no data, no discord
            if label == 1: next_s = 0b10111 # 0b1011 strong pos
            elif label == 0: next_s = 0b10000 # 0b1000 strong neg
        elif s == 0b11: # no data, has discord
            if label == 1: next_s = 0b1111 # medium pos
            elif label == 0: next_s = 0b1100 # medium neg
        elif s == 0b100: # maybe neg
            if label == 1: next_s = 0b10011 # weak pos
            elif label == 0: next_s = 0b10000 # strong neg
        elif s == 0b101: # maybe pos
            if label == 1: next_s = 0b10111 # strong pos
            elif label == 0: next_s = 0b10100 # weak neg
    elif client_type == 2 or client_type == 3: # laypeople and amateurs
        if s == -1: # 0b10 no data, no discord
            if label == 1: next_s = 0b101 # maybe pos
            elif label == 0: next_s = 0b100 # maybe neg
        elif s == 0b11: # no data, has discord
            if label == 1: next_s = 0b10011 # 0b111 weak pos
            elif label == 0: next_s = 0b10100 # 0b110 weak neg
        elif s == 0b100: # maybe neg
            if label == 1: next_s = 0b11 # 0b1001 no data, has discord
            elif label == 0: next_s = 0b10000 # 0b1000 strong neg
        elif s == 0b101: # maybe pos
            if label == 1: next_s = 0b10111 # 0b1011 strong pos
            elif label == 0: next_s = 0b11 # 0b1010 no data, has discord
    # Return state
    return next_s

"""
Update the database
"""
def update_db():
    try:
        db.session.commit() # IMPORTANT: if no database, this line will hang
    except Exception as ex:
        template = "!!!!!!!!!!!!!!!\nAn exception of type {0} occurred. Arguments:\n{1!r}"
        message = template.format(type(ex).__name__, ex.args)
        log_error(message)
        db.session.rollback()

"""
Add a row to the database
"""
def add_row(row):
    try:
        db.session.add(row)
        db.session.commit() # IMPORTANT: if no database, this line will hang
        db.session.refresh(row)
        return row
    except Exception as ex:
        template = "!!!!!!!!!!!!!!!\nAn exception of type {0} occurred. Arguments:\n{1!r}"
        message = template.format(type(ex).__name__, ex.args)
        log_error(message)
        db.session.rollback()

"""
Add a video to the database
"""
def add_video(**kwargs):
    video = add_row(Video(**kwargs))
    log("Add video: %r" % video)
    return video

"""
Add a user to the database
"""
def add_user(**kwargs):
    user = add_row(User(**kwargs))
    log("Add user: %r" % user)
    return user

"""
Add a label record to the database
"""
def add_label(**kwargs):
    label = add_row(Label(**kwargs))
    log("Add label: %r" % label)
    return label

"""
Add a user connection record to the database
"""
def add_connection(**kwargs):
    connection = add_row(Connection(**kwargs))
    log("Add connection: %r" % connection)
    return connection

"""
Add a issued video batch record to the database
"""
def add_batch(**kwargs):
    batch = add_row(Batch(**kwargs))
    log("Add batch: %r" % batch)
    return batch

"""
Add a video view record to the database
"""
def add_view(**kwargs):
    view = add_row(View(**kwargs))
    log("Add view: %r" % view)
    return view

"""
Query a batch of videos for labeling by using active learning or random sampling
"""
def query_video_batch(user_id, use_admin_label_state=False):
    # Get the video ids labeled by the user before
    v_ids = Label.query.filter(Label.user_id==user_id).from_self(Video).join(Video).distinct().with_entities(Video.id).all()
    undefined_labels = (-1, 0b11, 0b100, 0b101)
    labeled_video_ids = [v[0] for v in v_ids]
    if use_admin_label_state:
        # Exclude the videos that were labeled by the same user
        q = Video.query.filter(and_(Video.label_state_admin.in_(undefined_labels), Video.id.notin_(labeled_video_ids)))
        return q.order_by(func.random()).limit(batch_size).all()
    else:
        if gold_standard_in_batch == 0:
            # For admin researcher, do not add gold standards
            # Exclude the videos that were labeled by the same user
            q = Video.query.filter(and_(Video.label_state.in_(undefined_labels), Video.id.notin_(labeled_video_ids)))
            return q.order_by(func.random()).limit(batch_size).all()
        else:
            q_gold = Video.query.filter(Video.label_state_admin.in_((0b101111, 0b100000)))
            q_gold_pos = q_gold.filter(Video.label_state_admin==0b101111)
            gold_v_ids = q_gold.with_entities(Video.id).all()
            # Exclude videos that were labeled by the same user, also the gold standards
            q = Video.query.filter(and_(Video.label_state.in_(undefined_labels), Video.id.notin_(labeled_video_ids + gold_v_ids)))
            gold_pos = q_gold_pos.order_by(func.random()).limit(1).all() # use at least on gold pos to prevent spamming
            gold = q_gold.order_by(func.random()).limit(gold_standard_in_batch - 1).all()
            unlabeled = q.order_by(func.random()).limit(batch_size - gold_standard_in_batch).all()
            if (len(gold) != gold_standard_in_batch - 1):
                # This means that there are not enough or no gold standard videos
                return make_response("", 204)
            else:
                videos = gold + unlabeled + gold_pos
                shuffle(videos)
                return videos

"""
Get user token by using client id
"""
def get_user_token_by_client_id(client_id):
    user = User.query.filter(User.client_id==client_id).first()
    if user is None:
        user = add_user(client_id=client_id) # create a new user if not found
    user_id = user.id
    client_type = user.client_type
    user_score = user.score
    connection = add_connection(user_id=user_id, client_type=client_type, user_score=user_score)
    if client_type == -1:
        return None # a blacklisted user does not get the token
    else:
        return encode_user_jwt(user_id=user_id, client_type=client_type, connection_id=connection.id, iat=connection.time, user_score=user_score)

"""
Update client type by user id
"""
def update_client_type_by_user_id(user_id=None, client_type=None):
    if user_id is None or client_type is None: return
    user = User.query.filter(User.id==user_id).first()
    if user is not None:
        user.client_type = client_type
        log("Update client type for user: %r" % user)
        update_db()
    else:
        log_warning("Cannot find user with id: %r" % user_id)

"""
Encode video batch jwt
"""
def encode_video_jwt(**kwargs):
    t = kwargs["iat"] if "iat" in kwargs else get_current_time()
    payload = {}
    payload["iat"] = t
    payload["nbf"] = t + video_jwt_nbf_duration
    payload["jti"] = uuid.uuid4().hex
    for k in kwargs:
        payload[k] = kwargs[k]
    return encode_jwt(payload=payload)

"""
Encode user jwt
"""
def encode_user_jwt(**kwargs):
    t = kwargs["iat"] if "iat" in kwargs else get_current_time()
    payload = {}
    payload["iat"] = t
    payload["jti"] = uuid.uuid4().hex
    for k in kwargs:
        payload[k] = kwargs[k]
    return encode_jwt(payload=payload)

"""
Encode jwt
- encrypt the message into a JSON Web Token (JWT) by using HMAC and SHA-256
- (https://pyjwt.readthedocs.io/en/latest/)
"""
def encode_jwt(payload={}):
    return jwt.encode(payload, private_key, algorithm="HS256").decode("utf-8")

"""
Decode jwt
"""
def decode_jwt(token):
    return jwt.decode(token, private_key, algorithms=["HS256"])

"""
Custom logs
"""
def log_custom(msg, level="info"):
    try:
        d = {"method": request.method, "path": request.full_path, "agent": request.user_agent.string}
        if request.headers.getlist("X-Forwarded-For"):
            d["ip"] = request.headers.getlist("X-Forwarded-For")[0]
        else:
            d["ip"] = request.remote_addr
        if level == "info":
            logger.info(msg, extra=d)
        elif level == "warning":
            logger.warning(msg, extra=d)
        elif level == "error":
            logger.error(msg, extra=d)
    except Exception as ex:
        pass

"""
Log info
"""
def log(msg):
    app.logger.info("\n\n\t" + msg + "\n")
    if app.config["ENV"] == "production":
        log_custom(msg, level="info")

"""
Log warning
"""
def log_warning(msg):
    app.logger.warning("\n\n\t" + msg + "\n")
    if app.config["ENV"] == "production":
        log_custom(msg, level="warning")

"""
Log error
"""
def log_error(msg):
    app.logger.error("\n\n\t" + msg + "\n")
    if app.config["ENV"] == "production":
        log_custom(msg, level="error")
