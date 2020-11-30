"""
This file takes a json file with a specific format (described below),
...and then generate a set of videos (each video has 36 frames)

Format of the json file:
    {
        "CAMERA_ID_0": [
            [
                EXAMPLE_URL_OF_VIEW_0_ON_DATE_0,
                EXAMPLE_URL_OF_VIEW_1_ON_DATE_0,
                ...
            ],
            [
                EXAMPLE_URL_OF_VIEW_0_ON_DATE_1,
                EXAMPLE_URL_OF_VIEW_1_ON_DATE_1,
                ...
            ],
        ],
        "CAMERA_ID_1": [...]
    }

An example of the URL is below:
    https://thumbnails-v2.createlab.org/thumbnail?root=https://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2018-06-11.timemachine/&width=180&height=180&startFrame=9716&format=mp4&fps=12&tileFormat=mp4&startDwell=0&endDwell=0&boundsLTRB=6304,964,6807,1467&labelsFromDataset&nframes=36

For each URL in the json file, this code only uses the date and bounds information.
"""


import sys
from application import add_video, get_all_url_part
import requests
from datetime import datetime
import pytz
import numpy as np
import json
from urllib.parse import urlparse, parse_qs
import re

video_size = 180
videos_path = "../data/video_samples/1.json"
#videos_path = "../data/video_samples/2.json"
#videos_path = "../data/video_samples/3.json"

# Get video samples
with open(videos_path) as f:
    video_samples = json.load(f)

# The sun set and rise time in Pittsburgh
# Format: [[Jan_sunrise, Jan_sunset], [Feb_sunrise, Feb_sunset], ...]
pittsburgh_sun_table = [(8,16), (8,17), (8,18), (7,19), (6,19), (6,20), (6,19), (7,19), (7,18), (8,17), (8,16), (8,16)]


def request_json(url):
    r = requests.get(url)
    if r.status_code == 200:
        return r.json()
    else:
        return None


# Return a thumbnail server url
# ds: date (str), "2015-05-22"
# b: bounding box (dictionary with Left Top Right Bottom), {"L": 2330, "T": 690, "R": 3730, "B": 2090}
# w: width (int)
# h: height (int)
# sf: start frame number (int)
# fmt: format (str), "gif" or "mp4" or "png"
# fps: frames per second (int)
# nf: number of frames (int)
def get_url_part(cam_name=None, ds=None, b=None, w=180, h=180, sf=None, fmt="mp4", fps=12, nf=36):
    return "?root=http://tiles.cmucreatelab.org/ecam/timemachines/%s/%s.timemachine/&boundsLTRB=%r,%r,%r,%r&width=%r&height=%r&startFrame=%r&format=%s&fps=%r&tileFormat=mp4&nframes=%r" % (cam_name, ds, b["L"], b["T"], b["R"], b["B"], w, h, sf, fmt, fps, nf)


def get_tm_json_url(cam_name=None, ds=None):
    return "https://tiles.cmucreatelab.org/ecam/timemachines/%s/%s.timemachine/tm.json" % (cam_name, ds)


# Given a capture time array (from time machine), sample a start frame parameter set with size n
# nf: number of frames of the video
def sample_start_frame(ct_list, n=1, nf=36):
    sunset = None
    sunrise = None
    frame_min = None
    frame_max = None
    for i in range(len(ct_list)):
        dt = strptime_1(ct_list[i])
        if sunset is None:
            sunrise, sunset = pittsburgh_sun_table[dt.month - 1]
        if frame_min is None and dt.hour >= sunrise:
            frame_min = i + 1
        if frame_max is None and dt.hour == sunset + 1:
            frame_max = i
            break
    if frame_min is None:
        return (None, None, None)
    if frame_max is None:
        frame_max = len(ct_list)
    r = range(frame_min, frame_max + nf - 1)
    if len(r) == 0:
        return (None, None, None)
    # Sample a list of start frames
    sf_list = np.random.choice(r, n)
    sf_dt_list = []
    ef_dt_list = []
    for sf in sf_list:
        sf_dt_list.append(strptime_1(ct_list[sf]))
        ef_dt_list.append(strptime_1(ct_list[sf + nf - 1]))
    return (sf_list, sf_dt_list, ef_dt_list)


def strptime_1(ds):
    return datetime.strptime(ds, "%Y-%m-%d %H:%M:%S")


# Give a bound parameter set, randomly sample n bounds
# b = {"L": 828, "T": 1004, "R": 6193, "B": 1556, "max_size": 550, "min_size": 500}
def sample_bound(b, n=1):
    min_rg = b["min_size"] + 1 if b["min_size"] % 2 == 0 else b["min_size"]
    max_rg = b["max_size"] + 1
    size_list = np.random.choice(range(min_rg, max_rg, 2), n)
    sampled_b_list = []
    for s in size_list:
        # Compute the inner box shape for the center of the video clip
        half_s = int((s - 1) / 2)
        L_inner = b["L"] + half_s
        T_inner = b["T"] + half_s
        R_inner = b["R"] - half_s
        B_inner = b["B"] - half_s
        # Sample the center point
        x = np.random.choice(range(L_inner, R_inner + 1))
        y = np.random.choice(range(T_inner, B_inner + 1))
        # Compute the bound
        sampled_b_list.append({
            "L": x - half_s,
            "T": y - half_s,
            "R": x + half_s,
            "B": y + half_s
        })
    return sampled_b_list


# Verify if the thumbnail server is happy for this url
def check_url(url_part):
    video_url_root = "https://thumbnails-v2.createlab.org/thumbnail"
    url = video_url_root + url_part
    r = requests.get(url)
    if r.status_code == 200:
        return True
    else:
        return False


# Given a capture time array (from time machine), divide it into a set of start time frames
# nf: number of frames of the video
def divide_start_frame(ct_list, nf=36):
    sunset = None
    sunrise = None
    frame_min = None
    frame_max = None
    for i in range(len(ct_list)):
        dt = strptime_1(ct_list[i])
        if sunset is None:
            sunrise, sunset = pittsburgh_sun_table[dt.month - 1]
        if frame_min is None and dt.hour >= sunrise:
            frame_min = i + 1
        if frame_max is None and dt.hour == sunset + 1:
            frame_max = i
            break
    if frame_min is None:
        return (None, None, None)
    if frame_max is None:
        frame_max = len(ct_list)
    r = range(frame_min, frame_max, nf)
    if len(r) == 0:
        return (None, None, None)
    # Get the start frame list
    sf_list = []
    sf_dt_list = []
    ef_dt_list = []
    for sf in r:
        ef = sf + nf - 1 # end frame
        if ef > frame_max: break
        sf_list.append(sf)
        sf_dt_list.append(strptime_1(ct_list[sf]))
        ef_dt_list.append(strptime_1(ct_list[ef]))
    return (sf_list, sf_dt_list, ef_dt_list)


def get_datetime_str_from_url(url):
    m = re.search("\d+-\d+-\d+\.timemachine", url)
    return m.group(0).split(".")[0]


def cam_name_to_id(name):
    if name == "clairton1":
        return 0
    elif name == "braddock1":
        return 1
    elif name == "westmifflin1":
        return 2
    else:
        return None


def add_videos(update=False):
    count = 0
    update_count = 0
    url_part_list = [u[0] for u in get_all_url_part()]
    for k in video_samples: # k is the camera name (use cam_name_to_id to convert k to camera_id)
        for url_list in video_samples[k]: # each list represents one day
            for view_id in range(len(url_list)):
                url = url_list[view_id]
                if url == "": continue
                ds = get_datetime_str_from_url(url)
                tm_json = request_json(get_tm_json_url(cam_name=k, ds=ds))
                if tm_json is None: continue
                sf_list, sf_dt_list, ef_dt_list = divide_start_frame(tm_json["capture-times"])
                if sf_list is None: continue
                b_str = parse_qs(urlparse(url).query)["boundsLTRB"][0]
                b_str_split = list(map(int, b_str.split(",")))
                b = {"L": b_str_split[0], "T": b_str_split[1], "R": b_str_split[2], "B": b_str_split[3]}
                for i in range(len(sf_list)):
                    count += 1
                    sf = sf_list[i]
                    url_part = get_url_part(cam_name=k, ds=ds, b=b, sf=sf, w=video_size, h=video_size)
                    if update:
                        if url_part in url_part_list:
                            print("Video already in database: " + url_part)
                            continue
                        if check_url(url_part):
                            camera_id = cam_name_to_id(k)
                            if camera_id is None: continue
                            s = (b["R"] - b["L"]) / video_size
                            st = int(sf_dt_list[i].timestamp())
                            et = int(ef_dt_list[i].timestamp())
                            fn = "%d-%d-%s-%r-%r-%r-%r-%r-%r-%r-%r-%r" % (camera_id, view_id, ds,
                                    b["L"], b["T"], b["R"], b["B"], video_size, video_size, sf, st, et)
                            video = add_video(file_name=fn, start_time=st, end_time=et, camera_id=camera_id, view_id=view_id,
                                    width=video_size, height=video_size, scale=s, left=b["L"], top=b["T"], url_part=url_part)
                            print(video)
                            update_count += 1
                        else:
                            print("Problem getting video: " + url_part)
                    else:
                        print(url_part)
                print("Generated %d videos" % (count))
                print("Updated %d videos" % (update_count))


def main(argv):
    # Add videos from a curated list
    if len(argv) > 1:
        if argv[1] == "confirm":
            add_videos(update=True)
        else:
            add_videos(update=False)
            print("Must confirm by running: python add_video_set_small.py confirm")
    else:
        add_videos(update=False)
        print("Must confirm by running: python add_video_set_small.py confirm")
    print("END")

if __name__ == "__main__":
    main(sys.argv)
