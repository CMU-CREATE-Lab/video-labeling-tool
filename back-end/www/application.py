from flask import Flask, render_template, jsonify, request, abort, g, make_response, has_request_context
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_marshmallow import Marshmallow
from sqlalchemy import func, and_, or_, not_, MetaData, desc
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
from urllib.parse import parse_qs
from random import shuffle
from flask.logging import default_handler

# Config Parameters
video_url_root = "https://smoke.createlab.org/videos/180/"
google_signin_client_id = Path("../data/google_signin_client_id").read_text().strip()
private_key = Path("../data/private_key").read_text().strip()
batch_size = 16 # the number of videos for each batch
video_jwt_nbf_duration = 5 # cooldown duration (seconds) before the jwt can be accepted (to prevent spam)
max_page_size = 1000 # the max page size allowed for getting videos
partial_label_ratio = 0.8 # 0.8 means that we want 80% of the requested videos to be partially labeled
gold_standard_in_batch = 4 # the number of gold standard videos added the batch for citizens (not reseacher)
if gold_standard_in_batch < 2: gold_standard_in_batch = 2 # must be larger than 2

# Set Formatter
class RequestFormatter(logging.Formatter):
    def format(self, record):
        if has_request_context():
            record.url = request.url
            record.method = request.method
            record.agent = request.user_agent.string
            record.data = request.get_data()
            if request.headers.getlist("X-Forwarded-For"):
                record.ip = request.headers.getlist("X-Forwarded-For")[0]
            else:
                record.ip = request.remote_addr
        return super().format(record)
formatter = RequestFormatter("[%(asctime)s] [%(ip)s] [%(url)s] [%(agent)s] [%(method)s] [%(data)s] %(levelname)s:\n\n\t%(message)s\n")
default_handler.setFormatter(formatter)

# Initialize the application
app = Flask(__name__)

# Setup cors for development
if app.config["ENV"] == "development":
    cors = CORS(app, resources={r"/api/*": {"origins": "*"}})

# Setup custom logger for production
if app.config["ENV"] == "production":
    custom_log_path = "../log/app.log"
    dir_name = os.path.dirname(custom_log_path)
    if dir_name != "" and not os.path.exists(dir_name):
        os.makedirs(dir_name) # create directory if it does not exist
    handler = logging.handlers.RotatingFileHandler(custom_log_path, mode="a", maxBytes=100000000, backupCount=200)
    handler.setFormatter(formatter)
    logger = logging.getLogger("video_labeling_tool")
    logger.setLevel(logging.INFO)
    for hdlr in logger.handlers[:]:
        logger.removeHandler(hdlr) # remove old handlers
    logger.addHandler(handler)

# Database variables
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

# Label set variables
pos_labels = [0b10111, 0b1111, 0b10011]
neg_labels = [0b10000, 0b1100, 0b10100]
pos_gold_labels = [0b101111]
neg_gold_labels = [0b100000]
maybe_pos_labels = [0b101]
maybe_neg_labels = [0b100]
discorded_labels = [0b11]
bad_labels = [-2]


def get_current_time():
    """
    Return the current epochtime in seconds
    """
    return round(time.time())


class Video(db.Model):
    """
    The class for the video table (Object–Relational Mapping)
    """
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
    # (using label_state_admin allows the system to compare researcher and citizen labels)
    label_state = db.Column(db.Integer, nullable=False, default=-1, index=True)
    label_state_admin = db.Column(db.Integer, nullable=False, default=-1, index=True)
    # The most recent epochtime that the label state is updated
    label_update_time = db.Column(db.Integer)
    # The view id within the same camera id
    view_id = db.Column(db.Integer, nullable=False, default=-1)
    # The camera id of the video
    camera_id = db.Column(db.Integer, nullable=False, default=-1)
    # Relationships
    label = db.relationship("Label", backref=db.backref("video", lazy=True), lazy=True)
    view = db.relationship("View", backref=db.backref("video", lazy=True), lazy=True)

    def __repr__(self):
        return ("<Video id=%r file_name=%r start_time=%r end_time=%r width=%r height=%r scale=%r left=%r, top=%r, url_part=%r label_state=%r, label_state_admin=%r, label_update_time=%r view_id=%r camera_id=%r>") % (self.id, self.file_name, self.start_time, self.end_time, self.width, self.height, self.scale, self.left, self.top, self.url_part, self.label_state, self.label_state_admin, self.label_update_time, self.view_id, self.camera_id)


class User(db.Model):
    """
    The class for the user table
    """
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
    # The score that the user obtained so far (number of effectively labeled videos that passed the system's check)
    score = db.Column(db.Integer, nullable=False, default=0)
    # The raw score that the user obtained so far (number of unlabeled video that the user went through so far)
    raw_score = db.Column(db.Integer, nullable=False, default=0)
    # The best action_type in the tutorial table
    # -1: did not take the tutorial
    # 0: took the tutorial
    # 1: did not pass the last batch in the tutorial
    # 2: passed the last batch (16 videos) during the third try with hints
    # 3: passed the last batch during the second try after showing the answers
    # 4: passed the last batch (16 videos) in the tutorial during the first try
    best_tutorial_action = db.Column(db.Integer, nullable=False, default=-1)
    # Relationships
    label = db.relationship("Label", backref=db.backref("user", lazy=True), lazy=True)
    connection = db.relationship("Connection", backref=db.backref("user", lazy=True), lazy=True)

    def __repr__(self):
        return ("<User id=%r client_id=%r client_type=%r register_time=%r score=%r raw_score=%r best_tutorial_action=%r>") % (self.id, self.client_id, self.client_type, self.register_time, self.score, self.raw_score, self.best_tutorial_action)


class Label(db.Model):
    """
    The class for the label history table
    """
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


class Connection(db.Model):
    """
    The class for the user connection history table (for tracking user sessions)
    """
    id = db.Column(db.Integer, primary_key=True)
    # The epochtime (in seconds) when the user connects to the server
    time = db.Column(db.Integer, nullable=False, default=get_current_time)
    # The current client type of the user (client type may change over time)
    client_type = db.Column(db.Integer, nullable=False)
    # The user id in the User table (the user who connected to the server)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    # Relationships
    batch = db.relationship("Batch", backref=db.backref("connection", lazy=True), lazy=True)
    view = db.relationship("View", backref=db.backref("connection", lazy=True), lazy=True)

    def __repr__(self):
        return ("<Connection id=%r time=%r client_type=%r user_id=%r>") % (self.id, self.time, self.client_type, self.user_id)


class Batch(db.Model):
    """
    The class for the issued video batch history table (for tracking video batches)
    """
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
    # Current score of the user (User.score)
    user_score = db.Column(db.Integer) # null means no information, added on 4/26/2019
    # Current raw score of the user (User.raw_score)
    user_raw_score = db.Column(db.Integer) # null means no information, added on 8/9/2019
    # Relationships
    label = db.relationship("Label", backref=db.backref("batch", lazy=True), lazy=True)

    def __repr__(self):
        return ("<Batch id=%r request_time=%r return_time=%r connection_id=%r score=%r num_unlabeled=%r num_gold_standard=%r user_score=%r user_raw_score=%r>") % (self.id, self.request_time, self.return_time, self.connection_id, self.score, self.num_unlabeled, self.num_gold_standard, self.user_score, self.user_raw_score)


class View(db.Model):
    """
    The table for tracking viewed videos
    """
    id = db.Column(db.Integer, primary_key=True)
    # The connection id in the Connection table
    connection_id = db.Column(db.Integer, db.ForeignKey("connection.id"), nullable=False)
    # The video id in the Video table
    video_id = db.Column(db.Integer, db.ForeignKey("video.id"), nullable=False)
    # The query type to get the videos
    # 0: query by label state
    # 1: query by user id
    query_type = db.Column(db.Integer, nullable=False)
    # The epochtime (in seconds) when the view is added
    time = db.Column(db.Integer, default=get_current_time)

    def __repr__(self):
        return ("<View id=%r connection_id=%r video_id=%r query_type=%r time=%r>") % (self.id, self.connection_id, self.video_id, self.query_type, self.time)


class Tutorial(db.Model):
    """
    The table to track if a user took or passed the tutorial
    """
    id = db.Column(db.Integer, primary_key=True)
    # The connection id in the Connection table
    connection_id = db.Column(db.Integer, db.ForeignKey("connection.id"), nullable=False)
    # The action type for the tutorial
    # 0: took the tutorial
    # 1: did not pass the last batch in the tutorial
    # 2: passed the last batch (16 videos) during the third try with hints
    # 3: passed the last batch during the second try after showing the answers
    # 4: passed the last batch (16 videos) in the tutorial during the first try
    action_type = db.Column(db.Integer, nullable=False)
    # The query type of the tutorial
    # 0: users enter the tutorial page (can come from multiple sources or different button clicks)
    # 1: users click the tutorial button on the webpage (not the prompt dialog)
    # 2: users click the tutorial button in the prompt dialog (not the webpage)
    query_type = db.Column(db.Integer, nullable=False)
    # The epochtime (in seconds) when the tutorial is taken or passed
    time = db.Column(db.Integer, default=get_current_time)

    def __repr__(self):
        return ("<Tutorial id=%r connection_id=%r action_type=%r query_type=%r time=%r>") % (self.id, self.connection_id, self.action_type, self.query_type, self.time)


class VideoSchema(ma.ModelSchema):
    """
    The schema for the video table, used for jsonify (for normal users in label mode)
    """
    class Meta:
        model = Video # the class for the model
        fields = ("id", "file_name") # fields to expose
videos_schema = VideoSchema(many=True)


class VideoSchemaWithDetail(ma.ModelSchema):
    """
    The schema for the video table, used for jsonify (for normal users in gallery mode)
    """
    class Meta:
        model = Video # the class for the model
        fields = ("id", "start_time", "view_id", "camera_id", "file_name")
videos_schema_with_detail = VideoSchemaWithDetail(many=True)


class VideoSchemaIsAdmin(ma.ModelSchema):
    """
    The schema for the video table, used for jsonify (for admin users)
    """
    class Meta:
        model = Video # the class for the model
        fields = ("id", "label_state", "label_state_admin", "start_time", "file_name", "view_id", "camera_id")
videos_schema_is_admin = VideoSchemaIsAdmin(many=True)


class InvalidUsage(Exception):
    """
    The class for handling errors, such as a bad request
    """
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


@app.errorhandler(InvalidUsage)
def handle_invalid_usage(error):
    """
    Error handler
    """
    log_error("<InvalidUsage status_code=%r message='%s'>" % (error.status_code, error.message))
    response = jsonify(error.to_dict())
    response.status_code = error.status_code
    return response


@app.route("/")
def index():
    """
    For the index page
    """
    return "Hello World!"


@app.route("/api/v1/login", methods=["POST"])
def login():
    """
    For the client to login
    """
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
        user_token, user_token_for_other_app = get_user_token_by_client_id(client_id)
        if user_token is None:
            e = InvalidUsage("Permission denied", status_code=403)
            return handle_invalid_usage(e)
        else:
            return_json = {"user_token": user_token, "user_token_for_other_app": user_token_for_other_app}
            return jsonify(return_json)
    else:
        e = InvalidUsage("Missing field: google_id_token or client_id", status_code=400)
        return handle_invalid_usage(e)


@app.route("/api/v1/get_batch", methods=["POST"])
def get_batch():
    """
    For the client to get a batch of video clips
    """
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
    if video_batch is None or len(video_batch) < batch_size:
        return make_response("", 204)
    else:
        if is_admin:
            batch = add_batch(num_gold_standard=0, num_unlabeled=batch_size) # no gold standard for researcher
        else:
            batch = add_batch(num_gold_standard=gold_standard_in_batch, num_unlabeled=batch_size-gold_standard_in_batch)
        return jsonify_videos(video_batch, sign=True, batch_id=batch.id, user_id=user_jwt["user_id"])


@app.route("/api/v1/send_batch", methods=["POST"])
def send_batch():
    """
    For the client to send labels of a batch back to the server
    """
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


@app.route("/api/v1/set_label_state", methods=["POST"])
def set_label_state():
    """
    Set video labels to positive, negative, or gold standard (only researcher can use this call)
    """
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


@app.route("/api/v1/get_pos_labels", methods=["GET", "POST"])
def get_pos_labels():
    """
    Get videos with positive labels (aggregated from both researcher and citizens)
    """
    return get_video_labels("pos", allow_user_id=True)


@app.route("/api/v1/get_neg_labels", methods=["GET", "POST"])
def get_neg_labels():
    """
    Get videos with negative labels (aggregated from both researcher and citizens)
    """
    return get_video_labels("neg")


@app.route("/api/v1/get_pos_gold_labels", methods=["POST"])
def get_pos_gold_labels():
    """
    Get videos with positive gold standard labels (only admin can use this call)
    Gold standard labels will only be set by researchers
    """
    return get_video_labels(pos_gold_labels, only_admin=True, use_admin_label_state=True)


@app.route("/api/v1/get_neg_gold_labels", methods=["POST"])
def get_neg_gold_labels():
    """
    Get videos with negative gold standard labels (only admin can use this call)
    Gold standard labels will only be set by researchers
    """
    return get_video_labels(neg_gold_labels, only_admin=True, use_admin_label_state=True)


@app.route("/api/v1/get_pos_labels_by_researcher", methods=["POST"])
def get_pos_labels_by_researcher():
    """
    Get researcher-labeled positive videos, exclude gold standards (only admin can use this call)
    """
    return get_video_labels(pos_labels, only_admin=True, use_admin_label_state=True)


@app.route("/api/v1/get_neg_labels_by_researcher", methods=["POST"])
def get_neg_labels_by_researcher():
    """
    Get researcher-labeled negative videos, exclude gold standards (only admin can use this call)
    """
    return get_video_labels(neg_labels, only_admin=True, use_admin_label_state=True)


@app.route("/api/v1/get_pos_labels_by_citizen", methods=["POST"])
def get_pos_labels_by_citizen():
    """
    Get citizen-labeled positive videos, exclude gold standards (only admin can use this call)
    """
    return get_video_labels(pos_labels, only_admin=True)


@app.route("/api/v1/get_neg_labels_by_citizen", methods=["POST"])
def get_neg_labels_by_citizen():
    """
    Get citizen-labeled negative videos, exclude gold standards (only admin can use this call)
    """
    return get_video_labels(neg_labels, only_admin=True)


@app.route("/api/v1/get_maybe_pos_labels", methods=["GET", "POST"])
def get_maybe_pos_labels():
    """
    Get videos with insufficient citizen-provided positive labels
    This type of label will only be set by citizens
    """
    return get_video_labels(maybe_pos_labels)


@app.route("/api/v1/get_maybe_neg_labels", methods=["GET", "POST"])
def get_maybe_neg_labels():
    """
    Get videos with insufficient citizen-provided positive labels
    This type of label will only be set by citizens
    """
    return get_video_labels(maybe_neg_labels)


@app.route("/api/v1/get_discorded_labels", methods=["GET", "POST"])
def get_discorded_labels():
    """
    Get videos with citizen discorded labels
    Partial labels will only be set by citizens
    """
    return get_video_labels(discorded_labels)


@app.route("/api/v1/get_bad_labels", methods=["POST"])
def get_bad_labels():
    """
    Get videos that were discarded (only admin can use this call)
    Bad labels will only be set by researchers
    """
    return get_video_labels(bad_labels, only_admin=True, use_admin_label_state=True)


@app.route("/api/v1/get_all_labels", methods=["POST"])
def get_all_labels():
    """
    Get all data (only admin can use this call)
    """
    return get_video_labels(None, only_admin=True)


@app.route("/api/v1/get_label_statistics", methods=["GET"])
def get_label_statistics():
    """
    Get statistics of the labels
    """
    full = pos_labels + neg_labels
    gold = pos_gold_labels + neg_gold_labels
    partial = maybe_pos_labels + maybe_neg_labels + discorded_labels
    q = Video.query
    num_all_videos = q.filter(Video.label_state_admin.notin_(bad_labels + gold)).count()
    num_fully_labeled = q.filter(and_(
        Video.label_state_admin.notin_(bad_labels + gold),
        or_(
            Video.label_state_admin.in_(full),
            Video.label_state.in_(full))
        )).count()
    num_partially_labeled = q.filter(Video.label_state.in_(partial)).count()
    return_json = {
        "num_all_videos": num_all_videos,
        "num_fully_labeled": num_fully_labeled,
        "num_partially_labeled": num_partially_labeled}
    return jsonify(return_json)


@app.route("/api/v1/add_tutorial_record", methods=["POST"])
def add_tutorial_record():
    """
    Add tutorial record to the database
    """
    if request.json is None:
        e = InvalidUsage("Missing json", status_code=400)
        return handle_invalid_usage(e)
    if "action_type" not in request.json:
        e = InvalidUsage("Missing field: action_type", status_code=400)
        return handle_invalid_usage(e)
    if "query_type" not in request.json:
        e = InvalidUsage("Missing field: query_type", status_code=400)
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
    # Update database
    try:
        # Add tutorial record
        action_type = request.json["action_type"]
        query_type = request.json["query_type"]
        add_tutorial(action_type=action_type, connection_id=user_jwt["connection_id"], query_type=query_type)
        # Update user
        user = User.query.filter(User.id==user_jwt["user_id"]).first()
        if action_type > user.best_tutorial_action:
            user.best_tutorial_action = action_type
            log("Update user: %r" % user)
            update_db()
        return make_response("", 204)
    except Exception as ex:
        e = InvalidUsage(ex.args[0], status_code=400)
        return handle_invalid_usage(e)


@app.after_request
def after_request(response):
    """
    Log the HTTP response after each request
    """
    log(response)
    return response


def get_video_labels(labels, allow_user_id=False, only_admin=False, use_admin_label_state=False):
    """
    Return a list of videos with specific type of labels

    Input:
        labels: input for the get_video_query function
            ...(see the docstring of the get_video_query function)
        allow_user_id: request videos by user id or not
        only_admin: only for admin users or not
        use_admin_label_state: input for the get_video_query function
            ...(see the docstring of the get_video_query function)

    Output: jsonified videos
    """
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
    is_researcher = True if user_jwt is not None and user_jwt["client_type"] == 0 else False
    if user_id is None:
        if labels is None and is_admin:
            return jsonify_videos(Video.query.all(), is_admin=True)
        else:
            q = get_video_query(labels, page_number, page_size, use_admin_label_state=use_admin_label_state)
            if not is_researcher: # ignore researcher
                add_video_views(q.items, user_jwt, query_type=0)
            return jsonify_videos(q.items, total=q.total, is_admin=is_admin, with_detail=True)
    else:
        q = get_pos_video_query_by_user_id(user_id, page_number, page_size, is_researcher)
        if not is_researcher: # ignore researcher
            add_video_views(q.items, user_jwt, query_type=1)
        # We need to set is_admin to True here because we want to show user agreements in the data
        return jsonify_videos(q.items, total=q.total, is_admin=True)


def add_video_views(videos, user_jwt, query_type=None):
    """
    Update the View table from a batch of videos

    Input:
        videos: video objects (defined by the Video model)
        user_jwt: the user token JWT
        query_type: the type of query that the front-end used to get videos
            ...(see the View table for definition)
    """
    if query_type is None: return
    for v in videos:
        # If connection_id is -1, this means that the connection is from other app, not the current app
        # We do not want to add this case to the view table
        if user_jwt is not None and user_jwt["connection_id"] != -1:
            add_view(connection_id=user_jwt["connection_id"], video_id=v.id, query_type=query_type)


def get_video_query(labels, page_number, page_size, use_admin_label_state=False):
    """
    Get video query from the database by the type of labels

    Input:
        labels: can be the raw label state (defined in the label_state_machine function)
            ...or a string ("pos" or "neg", which means positive or negative labels)
        page_number: the page number that the front-end requested
        page_size: the page size that the front-end requested
        use_admin_label_state: use the admin label state or not
            ...in the Video table, there are two types of label states:
            ...one is for the normal user, and another one is for the researcher
            ...which is the "label_state_admin" column in the Video table
            ...(see the definition of the "label_state_admin" column in the Video table)

    Output:
        q: the query object of the Video table
    """
    page_size = max_page_size if page_size > max_page_size else page_size
    q = None
    gold_labels = [0b101111, 0b100000]
    pos_labels = [0b10111, 0b1111, 0b10011]
    neg_labels = [0b10000, 0b1100, 0b10100]
    bad_labels = [-2]
    if type(labels) == list:
        if len(labels) > 1:
            if use_admin_label_state:
                q = Video.query.filter(Video.label_state_admin.in_(labels))
            else:
                # Exclude gold standards and bad labels for normal request
                q = Video.query.filter(and_(
                    Video.label_state.in_(labels),
                    Video.label_state_admin.notin_(gold_labels + bad_labels)))
        elif len(labels) == 1:
            if use_admin_label_state:
                q = Video.query.filter(Video.label_state_admin==labels[0])
            else:
                # Exclude gold standards and bad labels for normal request
                q = Video.query.filter(and_(
                    Video.label_state==labels[0],
                    Video.label_state_admin.notin_(gold_labels + bad_labels)))
    elif type(labels) == str:
        # Aggregate citizen and researcher labels
        # Researcher labels override citizen labels
        if labels == "pos":
            # Exclude gold standards and bad labels for normal request
            q = Video.query.filter(and_(
                Video.label_state_admin.notin_(gold_labels + bad_labels),
                or_(
                    Video.label_state_admin.in_(pos_labels),
                    and_(
                        Video.label_state_admin.notin_(pos_labels + neg_labels),
                        Video.label_state.in_(pos_labels)))))
        elif labels == "neg":
            # Exclude gold standards and bad labels for normal request
            q = Video.query.filter(and_(
                Video.label_state_admin.notin_(gold_labels + bad_labels),
                or_(
                    Video.label_state_admin.in_(neg_labels),
                    and_(
                        Video.label_state_admin.notin_(pos_labels + neg_labels),
                        Video.label_state.in_(neg_labels)))))
    q = q.order_by(desc(Video.label_update_time))
    if page_number is not None and page_size is not None:
        q = q.paginate(page_number, page_size, False)
    return q


def get_pos_video_query_by_user_id(user_id, page_number, page_size, is_researcher):
    """
    Get video query (with positive labels) from the database by user id (exclude gold standards)

    Notice that this function only returns videos with positive labels (i.e. videos having smoke)
    The returned videos are paginated, and the front-end needs to specify page number and size

    Input:
        user_id: the user id (defined in the User table)
        page_number: the page number that the front-end requested
        page_size: the page size that the front-end requested
        is_researcher: if the client type is researcher or not

    Output:
        q: the query object of the Video table
    """
    page_size = max_page_size if page_size > max_page_size else page_size
    if is_researcher: # researcher
        q = Label.query.filter(and_(Label.user_id==user_id, Label.label.in_([1, 0b10111, 0b1111, 0b10011])))
    else:
        q = Label.query.filter(and_(Label.user_id==user_id, Label.label==1))
    # Exclude gold standards
    q = q.from_self(Video).join(Video).distinct().filter(Video.label_state_admin!=0b101111)
    q = q.order_by(desc(Video.label_update_time))
    if page_number is not None and page_size is not None:
        q = q.paginate(page_number, page_size, False)
    return q


def jsonify_videos(videos, sign=False, batch_id=None, total=None, is_admin=False, user_id=None, with_detail=False):
    """
    Jsonify videos (convert video objects to json)

    Input:
        videos: a list of video objects
        sign: require digital signature or not
        batch_id: the video batch id (a part of the digital signature)
        total: the total number of videos
        is_admin: is the system administrator or not (affect the level of information to get from the Video table)
            ...(check the VideoSchemaIsAdmin class)
        user_id: the user id (a part of the digital signature)
        with_detail: for the normal front-end user, display details of the videos or not
            ...(check the VideoSchemaWithDetail class)

    Output: videos in the json format
    """
    if len(videos) == 0: return make_response("", 204)
    if is_admin:
        videos_json = videos_schema_is_admin.dump(videos)
    else:
        if with_detail:
            videos_json = videos_schema_with_detail.dump(videos)
        else:
            videos_json = videos_schema.dump(videos)
    if sign:
        video_id_list = []
    for i in range(len(videos_json)):
        videos_json[i]["url_root"] = video_url_root
        fn = videos_json[i]["file_name"]
        fns = fn.split("-")
        videos_json[i]["url_part"] = "%s-%s-%s/%s-%s/%s.mp4" % (fns[2], fns[3], fns[4], fns[0], fns[1], fn)
        if sign:
            video_id_list.append(videos_json[i]["id"])
    return_json = {"data": videos_json}
    if sign:
        return_json["video_token"] = encode_video_jwt(video_id_list=video_id_list, batch_id=batch_id, user_id=user_id)
    if total is not None:
        return_json["total"] = total
    return jsonify(return_json)


def compute_video_batch_score(video_batch_hashed, labels):
    """
    Compute the score of a video batch

    Input:
        video_batch_hashed (dict): video objects in a dictionary (the keys are the video id)
        labels: video labels that were returned by the front-end (0 or 1)

    Output:
        score: the score of this batch (the higher the better)
        ...score means the number of labeled videos that were accepted by the system
    """
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


def update_labels(labels, user_id, connection_id, batch_id, client_type):
    """
    Update the Video table when a new label is added, return the score of the batch

    Input:
        labels: video labels that were returned by the front-end (0 or 1)
        user_id: the user id (defined in the User table)
        connection_id: the connection id (defined in the Connection table)
        batch_id: the video batch id (defined in the Batch table)
        client_type: the type of user (defined in the User table)

    Output: a dictionary that contains the information of scores
        ...(for the front-end website to show user contributions)
    """
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
            batch.user_raw_score = user.raw_score
        log("Update batch: %r" % batch)
    # Add labeling history and update the video label state
    # If the batch score is 0, do not update the label history since this batch is not reliable
    user_score = None
    user_raw_score = None
    if batch_score is not None:
        user_raw_score = user.raw_score + batch.num_unlabeled
        user.raw_score = user_raw_score
        # Update user score
        if client_type != 0: # do not update the score for reseacher
            user_score = user.score + batch_score
            user.score = user_score
        log("Update user: %r" % user)
    if batch_score != 0: # batch_score can be None if from the dashboard when updating labels
        # Update labels
        for v in labels:
            v["user_id"] = user_id
            v["batch_id"] = batch_id
            label = add_label(**v)
            video = video_batch_hashed[v["video_id"]]
            video.label_update_time = label.time
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
    return {"batch": batch_score, "user": user_score, "raw": user_raw_score}


def label_state_machine(s, label, client_type):
    """
    A finite state machine to infer the new label state based on current label state and some inputs

    Input:
        s: the current state (see the definition of the states below)
        label: the labeling result, 0 means negative (no smoke), 1 means positive (has smoke)
        client_type: type of the client, see the User table

    Output:
        next_s: next state (return None for wrong inputs)

    Below is the definition of state:
    The first bit from the left indicates if the data is useful (1: useful, 0: discarded)
    The second bit from the left indicates if the data has discord (1: has discord, 0: no discord)
    The rest of the bits indicates positve (1) or negative (0) labels
    For example, if a layperson labels 0, will attach "0" to the current state
        0b101111 (47) : pos (gold standard), by reseacher [both INITIAL and TERMINAL STATE]
        0b100000 (32) : neg (gold standard), by reseacher [both INITIAL and TERMINAL STATE]
        0b10111 (23) : strong pos (no discord, by 1 laypeople/amateurs + 1 expert) [TERMINAL STATE]
        0b10100 (20) : weak neg (no discord, by 1 laypeople/amateurs + 1 expert) [TERMINAL STATE]
        0b10011 (19) : weak pos (no discord, by 1 laypeople/amateurs + 1 expert) [TERMINAL STATE]
        0b10000 (16) : strong neg (no discord, by 1 laypeople/amateurs + 1 expert) [TERMINAL STATE]
        0b1011 : strong pos (no discord, by 2 laypeople/amateurs, or 1 expert) -> 0b10111
        0b1001 -> 0b11
        0b1010 -> 0b11
        0b1000 : strong neg (no discord, by 2 laypeople/amateurs, or 1 expert) -> 0b10000
        0b1111 (15) : medium pos (has discord, verified by 1 expert) [NOT USED] [TERMINAL STATE]
        0b1100 (12) : medium neg (has discord, verified by 1 expert) [NOT USED] [TERMINAL STATE]
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

    [Change on May 10, 2019] For simplicity, experts now no longer add "00" or "11" to the label
    (Labels made by experts had higher weights than the ones made by laypeople/amateurs)
    """
    next_s = None
    # Researchers
    if client_type == 0:
        if label == 0b10111: next_s = 0b10111 # strong pos
        elif label == 0b10000: next_s = 0b10000 # strong neg
        elif label == 0b10011: next_s = 0b10011 # weak pos
        elif label == 0b10100: next_s = 0b10100 # weak neg
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
    if client_type in [1, 2, 3]: # laypeople, amateurs, and experts
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


def update_db():
    """
    Update the database
    """
    try:
        db.session.commit() # IMPORTANT: if no database, this line will hang
    except Exception as ex:
        template = "!!!!!!!!!!!!!!!\nAn exception of type {0} occurred. Arguments:\n{1!r}"
        message = template.format(type(ex).__name__, ex.args)
        log_error(message)
        db.session.rollback()


def add_row(row):
    """
    Add a row to the database

    Input:
        row: a database object (created using Object-Relational Mapping)
            ...(for example, the Video model class)
    """
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


def add_video(**kwargs):
    """
    Add a video to the database

    Input: arguments for the Video table

    Output: object for the Video table
    """
    video = add_row(Video(**kwargs))
    log("Add video: %r" % video)
    return video


def add_user(**kwargs):
    """
    Add a user to the database

    Input: arguments for the User table

    Output: object for the User table
    """
    user = add_row(User(**kwargs))
    log("Add user: %r" % user)
    return user


def add_label(**kwargs):
    """
    Add a label record to the database

    Input: arguments for the Label table

    Output: object for the Label table
    """
    label = add_row(Label(**kwargs))
    log("Add label: %r" % label)
    return label


def add_connection(**kwargs):
    """
    Add a user connection record to the database

    Input: arguments for the Connection table

    Output: object for the Connection table
    """
    connection = add_row(Connection(**kwargs))
    log("Add connection: %r" % connection)
    return connection


def add_batch(**kwargs):
    """
    Add a issued video batch record to the database

    Input: arguments for the Batch table

    Ouput: object for the Batch table
    """
    batch = add_row(Batch(**kwargs))
    log("Add batch: %r" % batch)
    return batch


def add_view(**kwargs):
    """
    Add a video view record to the database

    Input: arguments for the View table

    Ouput: object for the View table
    """
    view = add_row(View(**kwargs))
    log("Add view: %r" % view)
    return view


def add_tutorial(**kwargs):
    """
    Add a tutorial taken or passed record to the database

    Input: arguments for the Tutorial table

    Output: object for the Tutorial table
    """
    tutorial = add_row(Tutorial(**kwargs))
    log("Add tutorial: %r" % tutorial)
    return tutorial


def query_video_batch(user_id, use_admin_label_state=False):
    """
    Query a batch of videos for labeling by using active learning or random sampling

    Input:
        user_id: the id in the User table
        use_admin_label_state: whether returned videos should contain labeling information or not

    Output: a list of videos (the video object is defined in the Video model)
    """
    # Get the video ids labeled by the user before
    v_ids = Label.query.filter(Label.user_id==user_id).from_self(Video).join(Video).distinct().with_entities(Video.id).all()
    labeled_video_ids = [v[0] for v in v_ids]
    if use_admin_label_state:
        # For admin researcher, do not add gold standards
        # Exclude the videos that were labeled by the same user
        q = Video.query.filter(and_(Video.label_state_admin.in_((-1, 0b11, 0b100, 0b101)), Video.id.notin_(labeled_video_ids)))
        return q.order_by(func.random()).limit(batch_size).all()
    else:
        # Select gold standards (at least one pos and neg to prevent spamming)
        # Spamming patterns include ignoring or selecting all videos
        num_gold_pos = np.random.choice(range(1, gold_standard_in_batch))
        num_gold_neg = gold_standard_in_batch - num_gold_pos
        gold_pos = Video.query.filter(Video.label_state_admin==0b101111).order_by(func.random()).limit(num_gold_pos).all()
        gold_neg = Video.query.filter(Video.label_state_admin==0b100000).order_by(func.random()).limit(num_gold_neg).all()
        # Exclude videos labeled by the same user, also the gold standards and other terminal states of reseacher labels
        # (We do not want citizens to do the double work to confirm reseacher labeled videos)
        excluded_labels = (0b101111, 0b100000, 0b10111, 0b10000, 0b10011, 0b10100, 0b1111, 0b1100, -2)
        excluded_v_ids = Video.query.filter(Video.label_state_admin.in_(excluded_labels)).with_entities(Video.id).all()
        q = Video.query.filter(Video.id.notin_(labeled_video_ids + excluded_v_ids))
        # Try to include some partially labeled videos in this batch
        num_unlabeled = batch_size - gold_standard_in_batch
        num_partially_labeled = int(num_unlabeled*partial_label_ratio)
        partially_labeled = q.filter(Video.label_state.in_((0b11, 0b100, 0b101))).order_by(func.random()).limit(num_partially_labeled).all()
        not_labeled = q.filter(Video.label_state==-1).order_by(func.random()).limit(num_unlabeled - len(partially_labeled)).all()
        if (len(gold_pos + gold_neg) != gold_standard_in_batch):
            # This means that there are not enough or no gold standard videos
            return None
        else:
            videos = gold_pos + gold_neg + not_labeled + partially_labeled
            shuffle(videos)
            return videos


def get_user_token_by_client_id(client_id):
    """
    Get user token by using client id

    Input:
        client_id (str): the client id obtained by Google Analytics

    Output:
        user_token: the JWT for the video labeling tool's front-end webpage
        user_token_for_other_app: the JWT for the deep-smoke-machine repository to download data
            ...(https://github.com/CMU-CREATE-Lab/deep-smoke-machine)
    """
    user = User.query.filter(User.client_id==client_id).first()
    if user is None:
        user = add_user(client_id=client_id) # create a new user if not found
    user_id = user.id
    client_type = user.client_type
    user_score = user.score
    user_raw_score = user.raw_score
    connection = add_connection(user_id=user_id, client_type=client_type)
    ct = connection.time
    cid = connection.id
    if client_type == -1:
        return (None, None) # a blacklisted user does not get the token
    else:
        # Field user_score and user_raw_score is for the client to display the user score when loggin in
        # Field connection_id is for updating the batch information when the client sends labels back
        user_token = encode_user_jwt(user_id=user_id, client_type=client_type, connection_id=cid, iat=ct, user_score=user_score, user_raw_score=user_raw_score)
        # This is the token for other app to access video labels from API calls
        user_token_for_other_app = encode_user_jwt(user_id=user_id, client_type=client_type, connection_id=-1, iat=ct)
        return (user_token, user_token_for_other_app)


def update_client_type_by_user_id(user_id=None, client_type=None):
    """
    Update client type by user id

    Input:
        user_id (int): the id of the user in the database
        client_type (int): the type of the user in the database
            ...(see the description in the User model)
    """
    if user_id is None or client_type is None: return
    user = User.query.filter(User.id==user_id).first()
    if user is not None:
        user.client_type = client_type
        log("Update client type for user: %r" % user)
        update_db()
    else:
        log_warning("Cannot find user with id: %r" % user_id)


def encode_video_jwt(**kwargs):
    """
    Encode video batch jwt

    Input: video batch data for the server to know if the returned labels are valid

    Output: encoded JSON Web Token
    """
    t = kwargs["iat"] if "iat" in kwargs else get_current_time()
    payload = {}
    payload["iat"] = t
    payload["nbf"] = t + video_jwt_nbf_duration
    payload["jti"] = uuid.uuid4().hex
    for k in kwargs:
        payload[k] = kwargs[k]
    return encode_jwt(payload=payload)


def encode_user_jwt(**kwargs):
    """
    Encode user jwt

    Input: user data for the server to know if the returned labels are from a valid user

    Output: encoded JSON Web Token
    """
    t = kwargs["iat"] if "iat" in kwargs else get_current_time()
    payload = {}
    payload["iat"] = t
    payload["jti"] = uuid.uuid4().hex
    for k in kwargs:
        payload[k] = kwargs[k]
    return encode_jwt(payload=payload)


def encode_jwt(payload={}):
    """
    Encode jwt

    Encrypt the message into a JSON Web Token (JWT) by using HMAC and SHA-256
    (https://pyjwt.readthedocs.io/en/latest/)

    Input:
        payload (dict): the payload (data) part of the JSON Web Token

    Output: encoded JSON Web Token
    """
    return jwt.encode(payload, private_key, algorithm="HS256").decode("utf-8")


def decode_jwt(token):
    """
    Decode jwt

    Input:
        token (str): JSON Web Token

    Output: decoded JSON Web Token
    """
    return jwt.decode(token, private_key, algorithms=["HS256"])


def get_all_url_part():
    """
    Get all the url_part in the Video table

    Output: all url parts in the Video table
    """
    return Video.query.with_entities(Video.url_part).all()


def log_custom(msg, level="info"):
    """
    Custom logs

    Input:
        msg (str): a string to log
    """
    try:
        if has_request_context():
            if level == "info":
                logger.info(msg)
            elif level == "warning":
                logger.warning(msg)
            elif level == "error":
                logger.error(msg)
        else:
            print(msg)
    except Exception as ex:
        pass


def log(msg):
    """
    Log info

    Input:
        msg (str): a string to log
    """
    app.logger.info(msg)
    if app.config["ENV"] == "production":
        log_custom(msg, level="info")


def log_warning(msg):
    """
    Log warning

    Input:
        msg (str): a string to log
    """
    app.logger.warning(msg)
    if app.config["ENV"] == "production":
        log_custom(msg, level="warning")


def log_error(msg):
    """
    Log error

    Input:
        msg (str): a string to log
    """
    app.logger.error(msg)
    if app.config["ENV"] == "production":
        log_custom(msg, level="error")
