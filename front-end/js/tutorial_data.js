var tutorial_data = [{
  "instruction": "This tutorial provides guidelines about how to recognize smoke, which is expected to take less than 30 minutes. Each video is 3 seconds, which represents about 6 minutes in real-world time. Please select the one that contains smoke by clicking or tapping.",
  "data": [{
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2018-06-11.timemachine/&boundsLTRB=5648,1004,6150,1506&width=180&height=180&startFrame=11462&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Correct! This one has smoke.",
    "wrong": "Oops! This one has smoke and needs to be selected.",
    "label": 1
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2018-06-14.timemachine/&boundsLTRB=2053,1123,2556,1626&width=180&height=180&startFrame=9689&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Correct! This one does not have smoke.",
    "wrong": "Oops! This one does not have smoke and should not be selected.",
    "label": 0
  }]
}, {
  "instruction": "It can sometimes be difficult to tell the difference between smoke and steam. Please select the one that contains smoke.",
  "data": [{
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-01-11.timemachine/&boundsLTRB=6304,884,6807,1387&width=180&height=180&startFrame=8863&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Correct! This one has smoke. Compared to steam, smoke disappears slower. Smoke also has various colors, unclear edges, and different opacities.",
    "wrong": "Oops! This one has smoke and needs to be selected. Compared to steam, smoke disappears slower. Smoke also has various colors, unclear edges, and different opacities.",
    "label": 1
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-01-22.timemachine/&boundsLTRB=1196,1035,1699,1538&width=180&height=180&startFrame=6140&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Correct! This one shows mainly steam and should not be selected. Steam disappears faster and has sharp edges when compared to smoke. Steam also has extremely high opacity, which makes its background not visible.",
    "wrong": "Oops! This one shows mainly steam and should not be selected. Steam disappears faster and has sharp edges when compared to smoke. Steam also has extremely high opacity, which makes its background not visible.",
    "label": 0
  }]
}, {
  "instruction": "Smoke can have high and low opacities, which all need to be selected. Please select all the videos that contain smoke, even when the emission source is not visible.",
  "data": [{
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-02-03.timemachine/&boundsLTRB=3012,1045,3515,1548&width=180&height=180&startFrame=7352&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Correct! This one has high-opacity smoke, which can block most of the background.",
    "wrong": "Oops! This one has high-opacity smoke and needs to be selected. High-opacity smoke can block most of the background.",
    "label": 1
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2018-06-11.timemachine/&boundsLTRB=5329,1033,5831,1535&width=180&height=180&startFrame=10346&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Correct! This one has low-opacity smoke and steam.",
    "wrong": "Oops! This one has low-opacity smoke and steam, which needs to be selected.",
    "label": 1
  }]
}, {
  "instruction": "Smoke and steam can appear at the same time. Please select the one that contains smoke, even when steam is also present.",
  "data": [{
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-01-17.timemachine/&boundsLTRB=3012,1045,3515,1548&width=180&height=180&startFrame=4878&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Correct! This one shows both smoke (on the left) and steam (on the right).",
    "wrong": "Oops! This one shows both smoke (on the left) and steam (on the right), which should be selected.",
    "label": 1
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2018-12-13.timemachine/&boundsLTRB=4365,994,4867,1496&width=180&height=180&startFrame=5678&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Correct! This one shows mainly steam.",
    "wrong": "Oops! This one shows mainly steam, which should be ignored.",
    "label": 0
  }]
}, {
  "instruction": "Some of the following videos show bad weather, which should not be selected. Please select the one that contains smoke.",
  "data": [{
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2018-06-11.timemachine/&boundsLTRB=6007,1008,6509,1510&width=180&height=180&startFrame=13586&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Correct! This one has low-opacity smoke, and you can still see the background. The emission source is not visible.",
    "wrong": "Oops! Because this one has low-opacity smoke, which also needs to be selected, even its emission source is not visible. For low-opacity smoke, you can still see the background.",
    "label": 1
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-01-17.timemachine/&boundsLTRB=4365,994,4867,1496&width=180&height=180&startFrame=7902&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Correct! This one has bad weather. During bad weather, it is almost impossible to know if the video has smoke.",
    "wrong": "Oops! This one has bad weather, which should be ignored. During bad weather, it is almost impossible to know if the video has smoke.",
    "label": 0
  }]
}, {
  "instruction": "Great! You have learned how to label smoke! We took a while to get here, I know, but don't worry, it will be worth it. Now let's try some challenging cases. Please select the videos that contain smoke. You can select multiple ones.",
  "data": [{
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2018-06-11.timemachine/&boundsLTRB=3271,1116,3774,1619&width=180&height=180&startFrame=9518&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Correct! This one has high-opacity smoke.",
    "wrong": "Oops! This one has high-opacity smoke and needs to be selected.",
    "label": 1
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2018-06-11.timemachine/&boundsLTRB=6304,964,6807,1467&width=180&height=180&startFrame=7826&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Correct! This one has low-opacity smoke.",
    "wrong": "Oops! This one has low-opacity smoke and needs to be selected.",
    "label": 1
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-01-11.timemachine/&boundsLTRB=2053,1023,2556,1526&width=180&height=180&startFrame=4003&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Correct! This one shows mainly steam.",
    "wrong": "Oops! This one shows mainly steam, which should be ignored.",
    "label": 0
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-01-17.timemachine/&boundsLTRB=3981,1004,4484,1507&width=180&height=180&startFrame=7398&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Correct! This one shows both smoke (on the back near the stack) and steam.",
    "wrong": "Oops! This one shows both smoke (on the back near the stack) and steam, which should be selected.",
    "label": 1
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2018-08-06.timemachine/&boundsLTRB=3271,1116,3774,1619&width=180&height=180&startFrame=3499&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Correct! This one has bad weather.",
    "wrong": "Oops! This one has bad weather, which should be ignored.",
    "label": 0
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2018-11-10.timemachine/&boundsLTRB=5329,953,5831,1455&width=180&height=180&startFrame=5086&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Correct! This one shows cloud shadows and some steam.",
    "wrong": "Oops! This one shows cloud shadows and some steam (no smoke), which should be ignored.",
    "label": 0
  }]
}, {
  "instruction": "Excellent! Besides what you learned so far, smoke can also have different colors under various lighting and weather conditions. Please select the ones that contain smoke.",
  "data": [{
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-01-11.timemachine/&boundsLTRB=3012,1045,3515,1548&width=180&height=180&startFrame=9367&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Correct! This one has black smoke.",
    "wrong": "Oops! This one has black smoke, which needs to be selected.",
    "label": 1
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2018-07-07.timemachine/&boundsLTRB=3271,1116,3774,1619&width=180&height=180&startFrame=5441&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Correct! This one has grayish smoke.",
    "wrong": "Oops! This one has grayish smoke, which needs to be selected.",
    "label": 1
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-01-11.timemachine/&boundsLTRB=3981,1004,4484,1507&width=180&height=180&startFrame=6523&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Correct! This one has whitish smoke that may look like steam.",
    "wrong": "Oops! This one has whitish smoke that may look like steam, which needs to be selected.",
    "label": 1
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2018-06-11.timemachine/&boundsLTRB=3012,1145,3515,1648&width=180&height=180&startFrame=10634&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Correct! This one has bluish and grayish smoke.",
    "wrong": "Oops! This one has bluish and grayish smoke, which needs to be selected.",
    "label": 1
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-01-22.timemachine/&boundsLTRB=3981,1004,4484,1507&width=180&height=180&startFrame=6068&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Correct! This one shows mainly steam.",
    "wrong": "Oops! This one shows mainly steam, which should be ignored.",
    "label": 0
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-01-11.timemachine/&boundsLTRB=3012,1045,3515,1548&width=180&height=180&startFrame=7747&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Correct! This one shows mainly steam.",
    "wrong": "Oops! This one shows mainly steam, which should be ignored.",
    "label": 0
  }]
}, {
  "instruction": "You did great and are getting close to master the skill of recognizing smoke! Now let's do a final practice to label a full batch. In the real task, you will see 16 videos in a batch. Please select the ones that contain smoke.",
  "until_all_correct": "You made progress! Let's aim for getting all of the labels correct. Now the same set of videos are randomly shuffled. Please select the ones that contain smoke.",
  "data": [{
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-01-11.timemachine/&boundsLTRB=6304,884,6807,1387&width=180&height=180&startFrame=5983&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Correct! This one has high-opacity smoke.",
    "wrong": "Oops! This one has high-opacity smoke and needs to be selected.",
    "label": 1
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2018-07-07.timemachine/&boundsLTRB=3271,1116,3774,1619&width=180&height=180&startFrame=4433&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Correct! This one has high-opacity smoke.",
    "wrong": "Oops! This one has high-opacity smoke and needs to be selected.",
    "label": 1
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2018-08-06.timemachine/&boundsLTRB=6304,964,6807,1467&width=180&height=180&startFrame=11563&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Correct! This one has high-opacity smoke.",
    "wrong": "Oops! This one has high-opacity smoke and needs to be selected.",
    "label": 1
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-01-11.timemachine/&boundsLTRB=5648,924,6150,1426&width=180&height=180&startFrame=7747&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Correct! This one has low-opacity smoke.",
    "wrong": "Oops! This one has low-opacity smoke and needs to be selected.",
    "label": 1
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2018-10-07.timemachine/&boundsLTRB=3012,1045,3515,1548&width=180&height=180&startFrame=6461&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Correct! This one has low-opacity smoke.",
    "wrong": "Oops! This one has low-opacity smoke and needs to be selected.",
    "label": 1
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2018-06-11.timemachine/&boundsLTRB=2583,1111,3086,1614&width=180&height=180&startFrame=13406&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Correct! This one has both smoke and steam.",
    "wrong": "Oops! This one has both smoke and steam, which needs to be selected.",
    "label": 1
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-01-11.timemachine/&boundsLTRB=3544,899,4026,1381&width=180&height=180&startFrame=6811&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Correct! This one has both smoke and steam.",
    "wrong": "Oops! This one has both smoke and steam, which needs to be selected.",
    "label": 1
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-02-02.timemachine/&boundsLTRB=3271,1016,3774,1519&width=180&height=180&startFrame=10061&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Correct! This one has both smoke and steam.",
    "wrong": "Oops! This one has both smoke and steam, which needs to be selected.",
    "label": 1
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-01-11.timemachine/&boundsLTRB=2053,1023,2556,1526&width=180&height=180&startFrame=9151&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Correct! This one shows mainly steam.",
    "wrong": "Oops! This one shows mainly steam, which should be ignored.",
    "label": 0
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-01-18.timemachine/&boundsLTRB=1196,1035,1699,1538&width=180&height=180&startFrame=6261&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Correct! This one shows mainly steam.",
    "wrong": "Oops! This one shows mainly steam, which should be ignored.",
    "label": 0
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2018-10-07.timemachine/&boundsLTRB=763,1032,1265,1534&width=180&height=180&startFrame=7361&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Correct! This one shows cloud shadows and some steam.",
    "wrong": "Oops! This one shows cloud shadows and some steam (no smoke), which should be ignored.",
    "label": 0
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-01-17.timemachine/&boundsLTRB=5648,924,6150,1426&width=180&height=180&startFrame=7938&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Correct! This one has bad weather.",
    "wrong": "Oops! This one has bad weather, which should be ignored.",
    "label": 0
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-01-22.timemachine/&boundsLTRB=2053,1023,2556,1526&width=180&height=180&startFrame=5996&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Correct! This one shows only steam.",
    "wrong": "Oops! This one shows only steam, which should be ignored.",
    "label": 0
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-02-02.timemachine/&boundsLTRB=763,1032,1265,1534&width=180&height=180&startFrame=4769&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Correct! This one has bad weather.",
    "wrong": "Oops! This one has bad weather, which should be ignored.",
    "label": 0
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-02-02.timemachine/&boundsLTRB=6304,884,6807,1387&width=180&height=180&startFrame=4589&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Correct! This one has bad weather.",
    "wrong": "Oops! This one has bad weather, which should be ignored.",
    "label": 0
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-04-09.timemachine/&boundsLTRB=2583,1011,3086,1514&width=180&height=180&startFrame=6059&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Correct! This one shows cloud shadows and some steam.",
    "wrong": "Oops! This one shows cloud shadows and some steam (no smoke), which should be ignored.",
    "label": 0
  }]
}];