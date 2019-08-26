import sys
from urllib.parse import urlparse, parse_qs
from application import *
from datetime import datetime, timedelta
import pytz

# An example video url is https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2018-06-14.timemachine/&boundsLTRB=3544,1009,4026,1491&width=180&height=180&startFrame=12137&format=mp4&fps=12&tileFormat=mp4&nframes=36&labelsFromDataset
# The function will remove all videos generated from this bounding box (3544,1009,4026,1491) at the same date (2018-06-14)
def mark_bad_videos(video_url, do_update=False):
    v = parse_qs(urlparse(video_url).query)
    if "root" not in v or "boundsLTRB" not in v:
        print("Error! Cannot fine url root and bounding box.")
        return
    r = v["root"][0]
    b = v["boundsLTRB"][0]
    b_split = list(map(int, b.split(",")))
    b = {"L": b_split[0], "T": b_split[1], "R": b_split[2], "B": b_split[3]}
    d = r.split("/")[6].split(".")[0]
    dt = datetime.strptime(d, "%Y-%m-%d")
    dt = pytz.timezone("US/Eastern").localize(dt)
    from_t = int((dt - timedelta(days=1)).timestamp())
    to_t = int((dt + timedelta(days=2)).timestamp())
    videos = Video.query.filter(and_(Video.left==b["L"], Video.top==b["T"], Video.width==180, Video.height==180, Video.start_time<to_t, Video.start_time>from_t, Video.end_time<to_t, Video.end_time>from_t))
    for vid in videos:
        if d in vid.url_part:
            vid.label_state = -2
            vid.label_state_admin = -2
            print("Mark bad video: " + vid.url_part)
    if do_update:
        update_db()
        print("Database updated.")

def main(argv):
    if len(argv) > 1:
        video_url = argv[1]
        if len(argv) > 2 and argv[2] == "confirm":
            mark_bad_videos(video_url, do_update=True)
        else:
            mark_bad_videos(video_url, do_update=False)
            print("Add the confirm at the end to update the database.")
            print("Usage: python mark_bad_videos.py [video_url] confirm")
    else:
        print("Usage: python mark_bad_videos.py [video_url]")

if __name__ == "__main__":
    main(sys.argv)
