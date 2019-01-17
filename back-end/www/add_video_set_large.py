from application import add_video
import json
from os import listdir
from os.path import isfile, join
import requests
import sys

# Return a list of all files in a folder
def get_all_file_names_in_folder(path):
    return  [f for f in listdir(path) if isfile(join(path, f))]

# Return a thumbnail server url
# - ds: date (str), "2015-05-22"
# - b: bounding box (dictionary), {"left": 2330, "top": 690, "right": 3730, "bottom": 2090}
# - w: width (int)
# - h: height (int)
# - sf: start frame number (int)
# - fmt: format (str), "gif" or "mp4" or "png"
# - fps: frames per second (int)
# - nf: number of frames (int)
def get_url_part(ds=None, b=None, w=None, h=None, sf=None, fmt="mp4", fps=12, nf=None):
    return "?root=http://tiles.cmucreatelab.org/ecam/timemachines/shenango1/%s.timemachine/&boundsLTRB=%r,%r,%r,%r&width=%r&height=%r&startFrame=%r&format=%s&fps=%r&tileFormat=mp4&nframes=%r" % (ds, b["left"], b["top"], b["right"], b["bottom"], w, h, sf, fmt, fps, nf)

# Verify if the thumbnail server is happy for this url
def check_url(url_part):
    video_url_root = "http://thumbnails.cmucreatelab.org/thumbnail"
    url = video_url_root + url_part
    r = requests.get(url)
    if r.status_code == 200:
        return True
    else:
        return False

# Add videos
def add_video_set_large():
    b = {"left": 2330, "top": 690, "right": 3730, "bottom": 2090} # bounding box
    w = 175
    h = 175
    s = (b["right"] - b["left"]) / w
    p = "../data/video_set_large/"
    do_url_check = True
    for n in get_all_file_names_in_folder(p):
        if ".json" not in n: continue
        with open(p + n) as f:
            data = json.load(f)
        sf = data["frames_start"]
        ef = data["frames_end"]
        for i in range(len(sf)):
            print("------------------------------------------------")
            ds = n[6:-5]
            u = get_url_part(ds=ds, b=b, w=w, h=h, sf=sf[i], nf=24)
            if do_url_check and not check_url(u):
                print("Fail to get video from: %s" % u)
                continue
            fn = "%s-%r-%r" % (ds, sf[i], ef[i])
            video = add_video(file_name=fn, start_time=0, end_time=0, width=w, height=h, scale=s, left=b["left"], top=b["top"], url_part=u)
            print(video)

argv = sys.argv
if len(argv) > 1:
    if argv[1] == "confirm":
        add_video_set_large()
    else:
        print("Must confirm by running: python add_video_set_large.py confirm")
else:
    print("Must confirm by running: python add_video_set_large.py confirm")
