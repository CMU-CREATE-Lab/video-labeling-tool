from application import add_video
import json
import numpy as np
import sys
argv = sys.argv
if len(argv) > 1:
    if argv[1] == "confirm":
        with open("../data/video_set_small.json") as f:
            data = np.array(json.load(f))
        for i in range(len(data)):
            print("------------------------------------------------")
            fname = "test" + str(i)
            video = add_video(file_name=fname, start_time=1, end_time=1, width=1, height=1, scale=1, left=1, top=1, url_part=data[i]["url_part"])
            print(video)
    else:
        print("Must confirm by running: python add_video_set_small.py confirm")
else:
    print("Must confirm by running: python add_video_set_small.py confirm")
