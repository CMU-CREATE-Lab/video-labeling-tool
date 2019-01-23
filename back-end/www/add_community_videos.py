from application import add_video
import requests
from datetime import datetime
import pytz
import numpy as np

video_size = 180

# The sun set and rise time in Pittsburgh
# Format: [[Jan_sunrise, Jan_sunset], [Feb_sunrise, Feb_sunset], ...]
pittsburgh_sun_table = [(8,5), (8,5), (7,7), (7,7), (6,8), (6,9), (6,9), (6,8), (7,7), (7,7), (8,5), (8,5)]

# Parameters for camera bounds that we want in https://mon.createlab.org/
# LTRB: the Left Top Right Bottom bounds that we want for each camera (boundsLTRB)
# max_size: The max of (R - L) or (B - T)
# min_size: The min of (R - L) or (B - T)
bounds = {
    "clairton1": {
        "L": 828,
        "T": 1004,
        "R": 6193,
        "B": 1556,
        "max_size": 550,
        "min_size": 500
    },
    "walnuttowers2": {
        "L": 384,
        "T": 1759,
        "R": 3857,
        "B": 2721,
        "max_size": 950,
        "min_size": 700
    },
    "braddock1": {
        "L": 2102,
        "T": 459,
        "R": 4132,
        "B": 1124,
        "max_size": 650,
        "min_size": 400
    },
    "westmifflin1": {
        "L": 591,
        "T": 1361,
        "R": 2989,
        "B": 2144,
        "max_size": 750,
        "min_size": 500
    }
}

def request_json(url):
    r = requests.get(url)
    if r.status_code == 200:
        return r.json()
    else:
        return None

def parse_cam_data(data):
    if data is None: return False
    a = []
    camera_id_list = bounds.keys()
    dt_map = {}
    for d in data:
        camera_id = d["camera_id"]
        if camera_id in camera_id_list:
            #dt = pytz.utc.localize(datetime.strptime(d["begin_time"], "%Y-%m-%dT%H:%M:%SZ"))
            dt = datetime.strptime(d["begin_time"][:10], "%Y-%m-%d")
            if camera_id not in dt_map:
                dt_map[camera_id] = [dt]
            else:
                dt_map[camera_id].append(dt)
    for d in dt_map:
        dt_map[d] = set(dt_map[d])
    return dt_map

# Return a thumbnail server url
# ds: date (str), "2015-05-22"
# b: bounding box (dictionary with Left Top Right Bottom), {"L": 2330, "T": 690, "R": 3730, "B": 2090}
# w: width (int)
# h: height (int)
# sf: start frame number (int)
# fmt: format (str), "gif" or "mp4" or "png"
# fps: frames per second (int)
# nf: number of frames (int)
def get_url_part(cam_id=None, ds=None, b=None, w=180, h=180, sf=None, fmt="mp4", fps=12, nf=24):
    return "?root=http://tiles.cmucreatelab.org/ecam/timemachines/%s/%s.timemachine/&boundsLTRB=%r,%r,%r,%r&width=%r&height=%r&startFrame=%r&format=%s&fps=%r&tileFormat=mp4&nframes=%r" % (cam_id, ds, b["L"], b["T"], b["R"], b["B"], w, h, sf, fmt, fps, nf)

def get_tm_json_url(cam_id=None, ds=None):
    return "https://tiles.cmucreatelab.org/ecam/timemachines/%s/%s.timemachine/tm.json" % (cam_id, ds)

# Given a capture time array, sample a start frame parameter set with size n
# nf: number of frames of the video
def sample_start_frame(ct_list, n=1, nf=24):
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

def add_videos(dt_map, n_sf=2, n_b=50):
    for k in dt_map:
        for dt in dt_map[k]:
            sampled_b_list = sample_bound(bounds[k], n=n_b)
            for b in sampled_b_list:
                ds = dt.strftime("%Y-%m-%d")
                tm_json = request_json(get_tm_json_url(cam_id=k, ds=ds))
                if tm_json is None: continue
                sample_sf_list, sample_sf_dt_list, sample_ef_dt_list = sample_start_frame(tm_json["capture-times"], n=n_sf)
                if sample_sf_list is None: continue
                for i in range(len(sample_sf_list)):
                    sf = sample_sf_list[i]
                    url_part = get_url_part(cam_id=k, ds=ds, b=b, sf=sf, w=video_size, h=video_size)
                    if check_url(url_part):
                        s = (b["R"] - b["L"]) / video_size
                        st = int(sample_sf_dt_list[i].timestamp())
                        et = int(sample_ef_dt_list[i].timestamp())
                        fn = "%s-%s-%r-%r-%r-%r-%r-%r-%r-%r-%r" % (k, ds, b["L"], b["T"], b["R"], b["B"], video_size, video_size, sf, st, et)
                        video = add_video(file_name=fn, start_time=st, end_time=et, width=video_size, height=video_size, scale=s, left=b["L"], top=b["T"], url_part=url_part)
                        print(video)

def main():
    cam_data = request_json("https://breathecam.cmucreatelab.org/camera_findings")
    add_videos(parse_cam_data(cam_data))
    print("END")

if __name__ == "__main__":
    main()
