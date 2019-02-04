#TODO: add a Gallery table to document the history that a user views videos
#TODO: how to promote the client to a different rank when it is changed? invalidate the user token?
#      (need to encode client type in the user token, and check if this matches the database record)
#      (for a user that did not login via google, always treat them as laypeople)
#TODO: implement a data analysis console and a content manage console for admin researchers
#TODO: add the last_queried_time to video and query the ones with last_queried_time <= current_time - lock_time
#TODO: implement the method for adding gold standards into the queried video batch
#TODO: implement the check for gold standards, reject the submission if gold standards are wrongly labeled
#TODO: store the number of gold standards in the Batch table and the accurracy of labeling them
#TODO: refactor code based on https://codeburst.io/jwt-authorization-in-flask-c63c1acf4eeb
#TODO: use https instead of http

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

"""
Config Parameters
"""
#video_url_root = "http://thumbnails.cmucreatelab.org/thumbnail"
video_url_root = "http://thumbnails-v2.createlab.org/thumbnail"
google_signin_client_id = Path("../data/google_signin_client_id").read_text().strip()
private_key = Path("../data/private_key").read_text().strip()
batch_size = 16 # the number of videos for each batch
video_jwt_nbf_duration = 5 # cooldown duration (seconds) before the jwt can be accepted (to prevent spam)

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
    label_state = db.Column(db.Integer, nullable=False, default=-1, index=True)
    # Relationships
    label = db.relationship("Label", backref=db.backref("video", lazy=True), lazy=True)

    def __repr__(self):
        return ("<Video id=%r file_name=%r start_time=%r end_time=%r width=%r height=%r scale=%r left=%r, top=%r, url_part=%r label_state=%r>") % (self.id, self.file_name, self.start_time, self.end_time, self.width, self.height, self.scale, self.left, self.top, self.url_part, self.label_state)

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
    # Relationships
    label = db.relationship("Label", backref=db.backref("user", lazy=True), lazy=True)
    connection = db.relationship("Connection", backref=db.backref("user", lazy=True), lazy=True)

    def __repr__(self):
        return ("<User id=%r client_id=%r client_type=%r register_time=%r>") % (self.id, self.client_id, self.client_type, self.register_time)

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
    # Relationships
    batch = db.relationship("Batch", backref=db.backref("connection", lazy=True), lazy=True)

    def __repr__(self):
        return ("<Connection id=%r time=%r client_type=%r user_id=%r>") % (self.id, self.time, self.client_type, self.user_id)

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
    # Relationships
    label = db.relationship("Label", backref=db.backref("batch", lazy=True), lazy=True)

    def __repr__(self):
        return ("<Batch id=%r request_time=%r return_time=%r connection_id=%r>") % (self.id, self.request_time, self.return_time, self.connection_id)

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
class VideoSchemaNoLabel(ma.ModelSchema):
    class Meta:
        model = Video # the class for the model
        fields = ("id", "url_part") # fields to expose
video_schema_no_label = VideoSchemaNoLabel()
videos_schema_no_label = VideoSchemaNoLabel(many=True)

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
                e = InvalidUsage("Wrong token issuer.", status_code=401)
                return handle_invalid_usage(e)
            client_id = "google.%s" % id_info["sub"]
        else:
            if "client_id" in request.json:
                client_id = request.json["client_id"]
    # Get user id by client id, and issued an user jwt
    if client_id is not None:
        return_json = {"user_token": get_user_token_by_client_id(client_id)}
        return jsonify(return_json)
    else:
        e = InvalidUsage("Missing field: google_id_token or client_id.", status_code=400)
        return handle_invalid_usage(e)

"""
For the client to get a batch of video clips
"""
@app.route("/api/v1/get_batch", methods=["POST"])
def get_batch():
    if request.json is not None and "user_token" in request.json:
        # Decode user jwt
        try:
            user_jwt = decode_jwt(request.json["user_token"])
            user_id = user_jwt["user_id"]
        except jwt.InvalidSignatureError as ex:
            e = InvalidUsage(ex.args[0], status_code=401)
            return handle_invalid_usage(e)
        except Exception as ex:
            e = InvalidUsage(ex.args[0], status_code=401)
            return handle_invalid_usage(e)
        # Query videos (active learning or random sampling)
        video_batch = query_video_batch(user_id)
        if len(video_batch) < batch_size:
            return make_response("", 204)
        else:
            batch = add_batch()
            return jsonify_videos(video_batch, sign=True, batch_id=batch.id)
    else:
        e = InvalidUsage("Missing field: user_token", status_code=400)
        return handle_invalid_usage(e)

"""
For the client to send labels of a batch back to the server
"""
@app.route("/api/v1/send_batch", methods=["POST"])
def send_batch():
    if request.json is not None and "data" in request.json and "video_token" in request.json and "user_token" in request.json:
        labels = request.json["data"]
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
        # Verify video id list
        original_v = video_jwt["video_id_list"]
        returned_v = [v["video_id"] for v in labels]
        if Counter(original_v) != Counter(returned_v):
            e = InvalidUsage("Signature of the video batch is not valid.", status_code=401)
            return handle_invalid_usage(e)
        # Update database
        try:
            update_video_labels(labels, user_jwt["user_id"], user_jwt["connection_id"], video_jwt["batch_id"], user_jwt["client_type"])
            return make_response("", 204)
        except Exception as ex:
            e = InvalidUsage(ex.args[0], status_code=400)
            return handle_invalid_usage(e)
    else:
        e = InvalidUsage("Missing fields: data, video_token, and user_token.", status_code=400)
        return handle_invalid_usage(e)

"""
Set video labels to positive, negative, or gold standard (only admin can use this call)
"""
@app.route("/api/v1/admin_set_labels", methods=["POST"])
def admin_set_labels():
    if request.json is not None and "data" in request.json and "user_token" in request.json:
        labels = request.json["data"]
        # Decode user jwt
        try:
            user_jwt = decode_jwt(request.json["user_token"])
        except jwt.InvalidSignatureError as ex:
            e = InvalidUsage(ex.args[0], status_code=401)
            return handle_invalid_usage(e)
        except Exception as ex:
            e = InvalidUsage(ex.args[0], status_code=401)
            return handle_invalid_usage(e)
        # Verify if the user is admin
        if user_jwt["client_type"] != 0:
            e = InvalidUsage("Permission denied.", status_code=403)
            return handle_invalid_usage(e)
        # Update database
        try:
            update_video_labels(labels, user_jwt["user_id"], None, None, user_jwt["client_type"])
            return make_response("", 204)
        except Exception as ex:
            e = InvalidUsage(ex.args[0], status_code=400)
            return handle_invalid_usage(e)
    else:
        e = InvalidUsage("Missing fields: data and user_token.", status_code=400)
        return handle_invalid_usage(e)

"""
Get videos with positive gold standard labels
"""
#@app.route("/api/v1/get_pos_gold_standard_labels", methods=["GET"])
def get_pos_gold_standard_labels():
    videos = Video.query.filter(Video.label_state==0b101111).all()
    return jsonify_videos(videos)

"""
Get videos with negative gold standard labels
"""
#@app.route("/api/v1/get_neg_gold_standard_labels", methods=["GET"])
def get_neg_gold_standard_labels():
    videos = Video.query.filter(Video.label_state==0b100000).all()
    return jsonify_videos(videos)

"""
Get videos with positive labels
"""
@app.route("/api/v1/get_pos_labels", methods=["GET", "POST"])
def get_pos_labels():
    user_id = request.args.get("user_id")
    page_number = request.args.get("pageNumber", 1, type=int)
    page_size = request.args.get("pageSize", 16, type=int)
    user_jwt = None
    data = request.get_data()
    if data is not None:
        qs = parse_qs(data.decode("utf8"))
        if "user_token" in qs:
            user_jwt = decode_jwt(qs["user_token"][0])
        if "pageNumber" in qs:
            page_number = int(qs["pageNumber"][0])
        if "pageSize" in qs:
            page_size = int(qs["pageSize"][0])
    if user_id is None:
        q = Video.query.filter(Video.label_state.in_((0b10111, 0b1111, 0b10011, 0b101111))).paginate(page_number, page_size, False)
        show_label = True if user_jwt is not None and user_jwt["client_type"] == 0 else False # show label if admin reseacher
        return jsonify_videos(q.items, total=q.total, show_label=show_label)
    else:
        q = Label.query.filter(and_(Label.user_id==user_id, Label.label==1)).from_self(Video).join(Video).distinct().paginate(page_number, page_size, False)
        return jsonify_videos(q.items, total=q.total, show_label="simple")

"""
Get videos with negative labels
"""
#@app.route("/api/v1/get_neg_labels", methods=["GET"])
def get_neg_labels():
    videos = Video.query.filter(Video.label_state.in_((0b10000, 0b1100, 0b10100, 0b100000))).all()
    return jsonify_videos(videos)

"""
Get videos with discarded labels
"""
#@app.route("/api/v1/get_bad_labels", methods=["GET"])
def get_bad_labels():
    videos = Video.query.filter(Video.label_state==0).all()
    return jsonify_videos(videos)

"""
Get videos with no labels or not enough labels
"""
#@app.route("/api/v1/get_no_labels", methods=["GET"])
def get_no_labels():
    # Do not include label state -1 because of too many unlabeled videos
    videos = Video.query.filter(Video.label_state.in_((0b11, 0b100, 0b101))).all()
    return jsonify_videos(videos)

"""
Jsonify videos
user_id: a part of the digital signature
sign: require digital signature or not
"""
def jsonify_videos(videos, sign=False, batch_id=None, total=None, show_label=False):
    if len(videos) == 0: return make_response("", 204)
    if show_label == False:
        videos_json, errors = videos_schema_no_label.dump(videos)
    else:
        videos_json, errors = videos_schema.dump(videos)
    if sign:
        video_id_list = []
    for i in range(len(videos_json)):
        videos_json[i]["url_root"] = video_url_root
        if show_label == "simple":
            s = videos_json[i]["label_state"]
            if s in [0b10011, 0b1111, 0b10111, 0b101111]:
                videos_json[i]["label_state"] = 1
            elif s in [0b10100, 0b1100, 0b10000, 0b100000]:
                videos_json[i]["label_state"] = 0
            else:
                videos_json[i]["label_state"] = -1
        if sign:
            video_id_list.append(videos_json[i]["id"])
    return_json = {"data": videos_json}
    if sign:
        return_json["video_token"] = encode_video_jwt(video_id_list=video_id_list, batch_id=batch_id)
    if total is not None:
        return_json["total"] = total
    return jsonify(return_json)

"""
Update the Video table when a new label is added
"""
def update_video_labels(labels, user_id, connection_id, batch_id, client_type):
    if len(labels) == 0: return
    # Record batch returned time
    if batch_id is not None and connection_id is not None:
        batch = Batch.query.filter(Batch.id==batch_id).first()
        batch.return_time = get_current_time()
        batch.connection_id = connection_id
        log("Update batch: %r" % batch)
    # Search the video batch and hash videos by video_id
    video_batch = Video.query.filter(Video.id.in_((v["video_id"] for v in labels))).all()
    video_batch_hashed = {}
    for video in video_batch:
        video_batch_hashed[video.id] = video
    # Add labeling history and update the video label state
    for v in labels:
        v["user_id"] = user_id
        v["batch_id"] = batch_id
        add_label(**v)
        video = video_batch_hashed[v["video_id"]]
        next_s = label_state_machine(video.label_state, v["label"], client_type)
        if next_s is not None:
            video.label_state = next_s
            log("Update video: %r" % video)
        else:
            log_warning("No next state for video: %r" % video)
    # Update database
    update_db()

"""
A finite state machine to infer the new label state based on current label state and some inputs
Return None for wrong inputs
The first bit from the left indicates if the data is useful (1: useful, 0: discarded)
The second bit from the left indicates if the data has discord (1: has discord, 0: no discord)
The rest of the bits indicates positve (1) or negative (0) labels
For example, if a layperson labels 0, will attach "0" to the current state
Another example, if an expert labels 1, will attach "11" to the current state
    0b101111 (47) : pos (gold standard) [both INITIAL and TERMINAL STATE]
    0b100000 (32) : neg (gold standard) [both INITIAL and TERMINAL STATE]
    0b10111 (23) : strong pos (no discord, by 1 laypeople/amateurs + 1 expert/researcher) [TERMINAL STATE]
    0b10100 (20) : weak neg (no discord, by 1 laypeople/amateurs + 1 expert/researcher) [TERMINAL STATE]
    0b10011 (19) : weak pos (no discord, by 1 laypeople/amateurs + 1 expert/researcher) [TERMINAL STATE]
    0b10000 (16) : strong neg (no discord, by 1 laypeople/amateurs + 1 expert/researcher) [TERMINAL STATE]
    0b1011 : strong pos (no discord, by 2 laypeople/amateurs, or 1 expert/researcher) -> 0b10111
    0b1001 -> 0b11
    0b1010 -> 0b11
    0b1000 : strong neg (no discord, by 2 laypeople/amateurs, or 1 expert/researcher) -> 0b10000
    0b1111 (15) : medium pos (has discord, verified by 1 expert/researcher) [TERMINAL STATE]
    0b1100 (12) : medium neg (has discord, verified by 1 expert/researcher) [TERMINAL STATE]
    0b111 : weak pos (has discord, verified by 1 layperson/amateur) -> 0b10011
    0b110 : weak neg (has discord, verified by 1 layperson/amateur) -> 0b10100
    0b101 (5) : maybe pos (by 1 layperson/amateur) [TRANSITIONAL STATE]
    0b100 (4) : maybe neg (by 1 layperson/amateur) [TRANSITIONAL STATE]
    0b11 (3) : no data, has discord [TRANSITIONAL STATE]
    0b10 -> -1
    0 : discarded data, by researchers [both INITIAL and TERMINAL STATE]
    -1 : no data, no discord [INITIAL state]
Notation "->" means that the state is merged to another state
For consistency, we always use -1 to indicate 0b10, the initial state that has no data
"""
def label_state_machine(s, label, client_type):
    next_s = None
    undefined_labels = [0b101, 0b100, 0b11, -1]
    # Researchers will always override the state
    if client_type == 0:
        if label == 1: next_s = 0b10111 # strong pos
        elif label == 0: next_s = 0b10000 # strong neg
        elif label == 11: next_s = 0b101111 # pos gold standard
        elif label == 10: next_s = 0b100000 # neg gold standard
    else:
        # Sanity check, can only use undefined labels (not terminal state)
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
Query a batch of videos for labeling by using active learning or random sampling
"""
def query_video_batch(user_id):
    v_ids = Label.query.filter(Label.user_id==user_id).from_self(Video).join(Video).distinct().with_entities(Video.id).all()
    q = Video.query.filter(and_(Video.label_state.in_((-1, 0b11, 0b100, 0b101)), Video.id.notin_([v[0] for v in v_ids])))
    #q = Video.query.filter(Video.label_state.in_((-1, 0b11, 0b100, 0b101)))
    return q.order_by(func.random()).limit(batch_size).all()

"""
Get user token by using client id
"""
def get_user_token_by_client_id(client_id):
    user = User.query.filter(User.client_id==client_id).first()
    if user is None:
        user = add_user(client_id=client_id) # create a new user if not found
    user_id = user.id
    client_type = user.client_type
    connection = add_connection(user_id=user_id, client_type=client_type)
    return encode_user_jwt(user_id=user_id, client_type=client_type, connection_id=connection.id, iat=connection.time)

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
    app.logger.info(msg)
    if app.config["ENV"] == "production":
        log_custom(msg, level="info")

"""
Log warning
"""
def log_warning(msg):
    app.logger.warning(msg)
    if app.config["ENV"] == "production":
        log_custom(msg, level="warning")

"""
Log error
"""
def log_error(msg):
    app.logger.error(msg)
    if app.config["ENV"] == "production":
        log_custom(msg, level="error")
