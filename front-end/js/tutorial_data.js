var general_prompt = "<ul><li>Smoke shows <u>various colors</u>, while steam is mostly whitish.</li><li>Smoke has <u>unclear edges</u> and <u>fades away slower</u> than steam.</li><li>Smoke has <u>various opacities</u>, while steam usually has high opacity.</li></ul>";
var general_wrong_txt = "<span class='custom-text-info-dark-theme'>Uh oh! Some answers are incorrect.</span> Don't worry! You still made good progress. We provide detailed comments below each video and highlight mistakes with color.";
var general_correct_txt = "Excellent! Your answers are all correct! We provide detailed comments and explanations below each video.";
var general_try_again_txt = "Let's try again and aim for getting all the labels correct. Now the same set of videos are randomly shuffled. Recall that:" + general_prompt + "Please select the ones that <u>have smoke</u>.";
var general_final_try_txt = "Let's try again and aim for getting all the labels correct. Now the same set of videos are randomly shuffled. Recall that:" + general_prompt + "Hints are also provided under each video. Please select the ones that <u>have smoke</u>.";
var general_need_to_select_head = "Oops! You should have selected this one because it ";
var general_not_to_select_head = "Oops! You should NOT have selected this one because it ";
var tutorial_data = [{
  "instruction": "This tutorial provides guidelines about how to recognize smoke, which will take about 10 to 20 minutes. Each video is 3 seconds, which represents about 6 minutes in real-world time. Please select <u>the video that has smoke</u> by clicking or tapping.",
  "wrong": general_wrong_txt,
  "correct": general_correct_txt,
  "data": [{
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2018-06-11.timemachine/&boundsLTRB=5648,1004,6150,1506&width=180&height=180&startFrame=11462&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Nice! This one has smoke.",
    "wrong": general_need_to_select_head + "has smoke.",
    "label": 1,
    "bound": "84,84 79,71 68,59 60,53 49,38 37,24 23,18 9,15 0,15 0,70 13,76 31,88 50,90 64,88 76,87"
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2018-06-14.timemachine/&boundsLTRB=2053,1123,2556,1626&width=180&height=180&startFrame=9689&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Great! This one does not have smoke.",
    "wrong": general_not_to_select_head + "does not have smoke.",
    "label": 0
  }]
}, {
  "instruction": "Smoke can have <u>high and low opacities</u>, which all need to be selected. Opacity means the percent of light (or the background) blocked by the smoke plume. In other words, high-opacity smoke can make most of its background not visible. Please select <u>all the videos that have smoke</u>, even with low opacity.",
  "wrong": general_wrong_txt,
  "correct": general_correct_txt,
  "data": [{
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-02-03.timemachine/&boundsLTRB=3012,1045,3515,1548&width=180&height=180&startFrame=7352&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Good job! This one has high-opacity smoke, which can block most of the background.",
    "wrong": general_need_to_select_head + "has high-opacity smoke, which can block most of the background.",
    "label": 1,
    "bound": "82,80 72,86 56,84 36,74 26,64 18,47 23,35 32,29 49,14 60,7 61,0 100,0 100,49 100,59 87,73"
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2018-06-11.timemachine/&boundsLTRB=6007,1008,6509,1510&width=180&height=180&startFrame=10526&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Great! This one has low-opacity smoke. Most of its background is still visible.",
    "wrong": general_need_to_select_head + "has low-opacity smoke. Most of its background is still visible.",
    "label": 1,
    "bound": "93,72 90,80 75,85 48,85 35,84 25,79 18,67 14,53 13,34 16,21 24,15 36,12 55,10 67,13 79,18 87,27 90,37 92,50 92,60"
  }]
}, {
  "instruction": "The emission source of smoke can be outside of the video's view, which still needs to be selected. Please select <u>all the videos that have smoke</u>, even when the <u>emission source is not in the video</u>.",
  "wrong": general_wrong_txt,
  "correct": general_correct_txt,
  "data": [{
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2018-06-11.timemachine/&boundsLTRB=6304,964,6807,1467&width=180&height=180&startFrame=8762&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Good job! This one has high-opacity smoke, which can block most of the background. The emission source is not shown in this video.",
    "wrong": general_need_to_select_head + "has high-opacity smoke, which can block most of the background. The emission source is not shown in this video.",
    "label": 1,
    "bound": "100,0 28,0 32,25 41,41 44,65 41,85 57,96 89,92 93,92 100,85 100,62"
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2018-07-07.timemachine/&boundsLTRB=5648,1004,6150,1506&width=180&height=180&startFrame=8105&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Great! This one has low-opacity smoke. The background is still visible. The emission source is not shown in this video.",
    "wrong": general_need_to_select_head + "has low-opacity smoke. The background is still visible. The emission source is not shown in this video.",
    "label": 1,
    "bound": "100,83 67,82 54,78 17,75 0,74 0,41 17,45 35,43 54,35 68,28 83,22 100,24"
  }]
}, {
  "instruction": "Smoke can also have <u>different colors</u> under various lighting and weather conditions. Please select <u>all the videos that have smoke</u>.",
  "wrong": general_wrong_txt,
  "correct": general_correct_txt,
  "data": [{
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-01-11.timemachine/&boundsLTRB=3012,1045,3515,1548&width=180&height=180&startFrame=9367&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Good job! This one has black smoke.",
    "wrong": general_need_to_select_head + "has black smoke.",
    "label": 1,
    "bound": "83,82 88,65 95,54 102,45 103,0 0,0 0,27 14,41 16,55 18,72 21,84 32,87 57,88 73,87"
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2018-06-11.timemachine/&boundsLTRB=3012,1145,3515,1648&width=180&height=180&startFrame=10634&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "That's right! This one has bluish and grayish smoke.",
    "wrong": general_need_to_select_head + "has bluish and grayish smoke.",
    "label": 1,
    "bound": "97,85 84,70 78,59 66,39 53,20 40,9 28,6 8,7 0,11 0,42 7,51 17,60 33,74 49,85 68,91 83,95 94,92"
  }]
}, {
  "instruction": "It can sometimes be difficult to tell the difference between smoke and steam. There are in general three rules:" + general_prompt + "Please select <u>the video that has smoke</u>.",
  "wrong": general_wrong_txt,
  "correct": general_correct_txt,
  "data": [{
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-01-11.timemachine/&boundsLTRB=6304,884,6807,1387&width=180&height=180&startFrame=8863&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Nice! This one has smoke. Compared to steam, smoke has various colors, unclear edges that fade slower, and different opacities.",
    "wrong": general_need_to_select_head + "has smoke. Compared to steam, smoke has various colors, unclear edges that fade slower, and different opacities.",
    "label": 1,
    "bound": "76,50 85,42 98,39 103,36 102,0 31,0 31,17 36,33 44,44 59,50 66,51"
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-01-22.timemachine/&boundsLTRB=1196,1035,1699,1538&width=180&height=180&startFrame=6140&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "That's right! This one shows mainly steam. Steam has sharper edges that fade faster when compared to smoke. Steam also has extremely high opacity, which makes its background not visible.",
    "wrong": general_not_to_select_head + "shows mainly steam. Steam has sharper edges that fade faster when compared to smoke. Steam also has extremely high opacity, which makes its background not visible.",
    "label": 0
  }]
}, {
  "instruction": "More practice of smoke and steam! Recall that:" + general_prompt + "Please select <u>the video that has smoke</u>.",
  "wrong": general_wrong_txt,
  "correct": general_correct_txt,
  "data": [{
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2018-07-07.timemachine/&boundsLTRB=3271,1116,3774,1619&width=180&height=180&startFrame=5441&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Great! This one has grayish smoke. Sometimes looking at the color is sufficient to tell the difference between steam and smoke.",
    "wrong": general_need_to_select_head + "has grayish smoke. Sometimes looking at the color is sufficient to tell the difference between steam and smoke.",
    "label": 1,
    "bound": "100,58 84,69 75,81 66,103 0,100 0,15 17,12 40,10 64,10 85,15 100,17"
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-01-22.timemachine/&boundsLTRB=3981,1004,4484,1507&width=180&height=180&startFrame=6068&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Nice! This one shows mainly steam. In this case, steam may look like smoke. But if you look at its edge, steam fades almost immediately.",
    "wrong": general_not_to_select_head + "shows mainly steam. In this case, steam may look like smoke. But if you look at its edge, steam fades almost immediately.",
    "label": 0
  }]
}, {
  "instruction": "Let's try another case when smoke and steam appear at the same time. Recall that:" + general_prompt + "Please select <u>the video that has smoke</u>, even when <u>steam is also present</u>.",
  "wrong": general_wrong_txt,
  "correct": general_correct_txt,
  "data": [{
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-01-17.timemachine/&boundsLTRB=3012,1045,3515,1548&width=180&height=180&startFrame=4878&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Good job! This one shows both smoke (on the left) and steam (on the right). Notice that in this case, smoke has a different color (yellowish) than steam. Steam usually appears whitish, while smoke can have different colors.",
    "wrong": general_need_to_select_head + "shows both smoke (on the left) and steam (on the right). Notice that in this case, smoke has a different color (yellowish) than steam. Steam usually appears whitish, while smoke can have different colors.",
    "label": 1,
    "bound": "38,78 39,62 46,50 46,31 43,12 42,0 0,0 0,56 9,72 16,79 28,80"
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2018-12-13.timemachine/&boundsLTRB=4365,994,4867,1496&width=180&height=180&startFrame=5678&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "That's right! This one shows mainly steam (with cloud shadow on the background). Note that steam's high opacity can block its background.",
    "wrong": general_not_to_select_head + "shows only steam (with cloud shadow on the background). Note that steam's high opacity can block its background.",
    "label": 0
  }]
}, {
  "instruction": "In harder cases, smoke and steam can appear together, especially when they look very similar.  Recall that:" + general_prompt + "Please select <u>the video that has smoke</u>, even when <u>steam is also present</u>.",
  "wrong": general_wrong_txt,
  "correct": general_correct_txt,
  "data": [{
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-01-11.timemachine/&boundsLTRB=3981,1004,4484,1507&width=180&height=180&startFrame=6523&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "That's right! This one has both steam and whitish smoke. Whitish smoke may look like steam and can be hard to identify. One way to distinguish them is that smoke can slowly fade away with lower opacities, while steam fades away immediately.",
    "wrong": general_need_to_select_head + "has both whitish smoke and steam. Whitish smoke may look like steam and can be hard to identify. One way to distinguish them is that smoke can slowly fade away with low opacities, while steam fades away immediately.",
    "label": 1,
    "bound": "59,91 64,78 72,67 83,55 94,43 100,32 100,0 0,0 0,64 10,77 22,87 40,89 51,90"
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-01-11.timemachine/&boundsLTRB=763,1032,1265,1534&width=180&height=180&startFrame=3931&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Nice! This one shows mainly steam. Steam disappears faster and has sharp edges when compared to smoke. Steam also has extremely high opacity, which makes its background not visible.",
    "wrong": general_not_to_select_head + "shows only steam. Steam disappears faster and has sharp edges when compared to smoke. Steam also has extremely high opacity, which makes its background not visible.",
    "label": 0
  }]
}, {
  "instruction": "Videos that show bad weather <u>should be ignored</u>. In general, when labeling real data, ignore the video if you are not sure whether it has smoke under bad weather conditions. Please select <u>the video that has smoke</u>.",
  "wrong": general_wrong_txt,
  "correct": general_correct_txt,
  "data": [{
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2018-06-11.timemachine/&boundsLTRB=6007,1008,6509,1510&width=180&height=180&startFrame=13586&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Great! This one has low-opacity smoke, and you can still see the background. The emission source is not visible.",
    "wrong": general_need_to_select_head + "has low-opacity smoke, even its emission source is not visible. For low-opacity smoke, you can still see the background.",
    "label": 1,
    "bound": "89,85 73,86 59,69 40,59 20,55 0,59 0,20 38,19 62,21 85,17 100,15 100,47 100,71"
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-01-17.timemachine/&boundsLTRB=4365,994,4867,1496&width=180&height=180&startFrame=7902&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Good job! This one shows bad weather. During bad weather, it is almost impossible to know if the video has smoke.",
    "wrong": general_not_to_select_head + "shows bad weather. During bad weather, it is almost impossible to know if the video has smoke.",
    "label": 0
  }]
}, {
  "instruction": "Great! You have learned how to label smoke! Now let's try some challenging cases. Please select <u>all the videos that have smoke</u>. You can select multiple ones.",
  "wrong": general_wrong_txt,
  "correct": general_correct_txt,
  "try_again": general_try_again_txt,
  "final_try": general_final_try_txt,
  "data": [{
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2018-06-11.timemachine/&boundsLTRB=3271,1116,3774,1619&width=180&height=180&startFrame=9518&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Nice! This one has grayish high-opacity smoke.",
    "wrong": general_need_to_select_head + "has grayish high-opacity smoke.",
    "hint": "On the bottom left, did you spot high-opacity smoke with unclear edges and grayish color?",
    "label": 1,
    "bound": "64,91 57,72 49,55 36,45 19,39 0,35 0,92 14,93 37,93 53,93"
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2018-06-11.timemachine/&boundsLTRB=6304,964,6807,1467&width=180&height=180&startFrame=7826&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Great! This one has low-opacity smoke.",
    "wrong": general_need_to_select_head + "has low-opacity smoke.",
    "hint": "Did you notice low-opacity smoke that blocks only some background?",
    "label": 1,
    "bound": "54,89 49,71 61,49 67,45 78,42 75,21 65,7 57,0 0,0 0,91 12,93 31,91 47,90"
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-01-17.timemachine/&boundsLTRB=3981,1004,4484,1507&width=180&height=180&startFrame=7398&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Good job! This one shows both smoke (on the back near the stack) and steam.",
    "wrong": general_need_to_select_head + "shows both smoke (on the back near the stack) and steam.",
    "hint": "Did you recognize the white smoke near the stack? It is sometimes mixed with steam.",
    "label": 1,
    "bound": "63,90 60,78 46,70 40,53 36,34 34,17 33,0 0,0 0,49 18,57 25,66 26,75 26,81 35,88 43,92 56,91"
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-01-11.timemachine/&boundsLTRB=2053,1023,2556,1526&width=180&height=180&startFrame=4003&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Nice! This one shows mainly steam.",
    "wrong": general_not_to_select_head + "shows mainly steam.",
    "hint": "This one looks like steam with white color and extremely high opacity, right?",
    "label": 0
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2018-08-06.timemachine/&boundsLTRB=3271,1116,3774,1619&width=180&height=180&startFrame=3499&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "That's right! This one shows bad weather.",
    "wrong": general_not_to_select_head + "shows bad weather.",
    "hint": "The weather is bad in this video, and it is almost impossible to know if smoke is present, right?",
    "label": 0
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2018-11-10.timemachine/&boundsLTRB=5329,953,5831,1455&width=180&height=180&startFrame=5086&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Nice! This one shows only cloud shadows and some steam.",
    "wrong": general_not_to_select_head + "shows only cloud shadows and some steam (no smoke).",
    "hint": "This one only has steam and cloud shadow, right?",
    "label": 0
  }]
}, {
  "instruction": "You did great and will master the skill of recognizing smoke! We took a while to get here, I know, but don't worry, it will be worth it. Now let's do a final practice to mimic the real task. Please select <u>all the videos that have smoke</u>.",
  "wrong": general_wrong_txt,
  "correct": general_correct_txt,
  "try_again": general_try_again_txt,
  "final_try": general_final_try_txt,
  "data": [{
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-01-11.timemachine/&boundsLTRB=6304,884,6807,1387&width=180&height=180&startFrame=5983&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Nice! This one has high-opacity smoke (emitted from the stack).",
    "wrong": general_need_to_select_head + "has high-opacity smoke (emitted from the stack).",
    "hint": "Did you notice high-opacity smoke with bluish color above the stack?",
    "label": 1,
    "bound": "75,56 89,53 100,41 100,35 100,0 25,0 27,23 38,42 51,55 63,61"
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2018-07-07.timemachine/&boundsLTRB=3271,1116,3774,1619&width=180&height=180&startFrame=4433&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Good job! This one has high-opacity smoke (bottom-left).",
    "wrong": general_need_to_select_head + "has high-opacity smoke (bottom-left).",
    "hint": "On the bottom left, did you spot high-opacity smoke with unclear edges and grayish color?",
    "label": 1,
    "bound": "54,100 59,87 67,71 82,66 100,63 100,54 100,11 64,12 27,15 0,21 0,100 44,100"
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2018-08-06.timemachine/&boundsLTRB=6304,964,6807,1467&width=180&height=180&startFrame=11563&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Great! This one has high-opacity smoke (bottom-left).",
    "wrong": general_need_to_select_head + "has high-opacity smoke (bottom-left).",
    "hint": "On the bottom left, did you see high-opacity smoke with unclear edges and dark color?",
    "label": 1,
    "bound": "40,89 37,75 40,52 41,32 36,15 23,10 12,11 0,19 0,85 13,92 22,93 32,92"
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-01-11.timemachine/&boundsLTRB=5648,924,6150,1426&width=180&height=180&startFrame=7747&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Nice! This one has low-opacity smoke (emitted from the stack).",
    "wrong": general_need_to_select_head + "has low-opacity smoke (emitted from the stack).",
    "hint": "Above the stack, did you recognize the emitted low-opacity smoke?",
    "label": 1,
    "bound": "38,45 42,38 48,25 52,15 42,7 31,5 24,10 22,27 25,44 32,47"
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2018-10-07.timemachine/&boundsLTRB=3012,1045,3515,1548&width=180&height=180&startFrame=6461&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "That's right! This one has low-opacity smoke.",
    "wrong": general_need_to_select_head + "has low-opacity smoke.",
    "hint": "Some low-opacity smoke is present, right?",
    "label": 1,
    "bound": "81,85 93,77 97,61 83,45 71,32 55,20 34,13 22,19 18,28 18,48 26,66 39,82 46,88 61,90 73,89"
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2018-06-11.timemachine/&boundsLTRB=2583,1111,3086,1614&width=180&height=180&startFrame=13406&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Nice! This one has both smoke and steam.",
    "wrong": general_need_to_select_head + "has both smoke and steam.",
    "hint": "Did you notice the smoke that comes from the right side and is sometimes mixed with steam?",
    "label": 1,
    "bound": "88,90 72,88 54,88 40,94 22,79 27,64 41,48 49,30 67,27 77,41 85,48 95,58 100,61 100,90"
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-01-11.timemachine/&boundsLTRB=3544,899,4026,1381&width=180&height=180&startFrame=6811&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Great! This one has both smoke and steam.",
    "wrong": general_need_to_select_head + "has both smoke and steam.",
    "hint": "Above the stack on the left, did you spot the emitted bluish smoke?",
    "label": 1,
    "bound": "0,49 20,49 42,48 68,55 93,61 100,59 100,23 64,22 35,22 19,23 0,24"
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-02-02.timemachine/&boundsLTRB=3271,1016,3774,1519&width=180&height=180&startFrame=10061&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "That's right! This one has both smoke and steam.",
    "wrong": general_need_to_select_head + "has both smoke and steam.",
    "hint": "On the bottom left, did you see whitish smoke that is mixed with steam?",
    "label": 1,
    "bound": "48,90 45,70 50,54 53,33 57,22 71,23 88,23 91,22 100,14 100,0 0,0 0,68 11,75 26,83 34,88 42,93"
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-01-11.timemachine/&boundsLTRB=2053,1023,2556,1526&width=180&height=180&startFrame=9151&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "That's right! This one shows mainly steam. The dark steam may be caused by the cloud shadow.",
    "wrong": general_not_to_select_head + "shows mainly steam. The dark steam may be caused by the cloud shadow.",
    "hint": "This one has only steam with white color and extremely high opacity, right?",
    "label": 0
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-01-18.timemachine/&boundsLTRB=1196,1035,1699,1538&width=180&height=180&startFrame=6261&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Great! This one shows mainly steam.",
    "wrong": general_not_to_select_head + "shows mainly steam.",
    "hint": "This one has only steam with white color and extremely high opacity, right?",
    "label": 0
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2018-10-07.timemachine/&boundsLTRB=763,1032,1265,1534&width=180&height=180&startFrame=7361&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Good job! This one shows only cloud shadows and some steam.",
    "wrong": general_not_to_select_head + "shows only cloud shadows and some steam (no smoke).",
    "hint": "This one has only some steam and many cloud shadows, right?",
    "label": 0
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-01-17.timemachine/&boundsLTRB=5648,924,6150,1426&width=180&height=180&startFrame=7938&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Great! This one has bad weather.",
    "wrong": general_not_to_select_head + "has bad weather.",
    "hint": "This one shows bad weather, and it is hard to see anything, right?",
    "label": 0
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-01-22.timemachine/&boundsLTRB=2053,1023,2556,1526&width=180&height=180&startFrame=5996&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Nice! This one shows only steam. The dark steam may be caused by the cloud shadow.",
    "wrong": general_not_to_select_head + "shows only steam. The dark steam may be caused by the cloud shadow.",
    "hint": "This one has only steam with extremely high opacity, right?",
    "label": 0
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-02-02.timemachine/&boundsLTRB=3012,1045,3515,1548&width=180&height=180&startFrame=4049&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "That's right! This one has bad weather.",
    "wrong": general_not_to_select_head + "has bad weather.",
    "hint": "The weather is bad in this video, and it is almost impossible to know if smoke is present, right?",
    "label": 0
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-02-02.timemachine/&boundsLTRB=6304,884,6807,1387&width=180&height=180&startFrame=4589&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Nice! This one has bad weather.",
    "wrong": general_not_to_select_head + "has bad weather.",
    "hint": "The weather is bad in this video, and it is almost impossible to know if smoke is present, right?",
    "label": 0
  }, {
    "url": "https://thumbnails-v2.createlab.org/thumbnail?root=http://tiles.cmucreatelab.org/ecam/timemachines/clairton1/2019-04-09.timemachine/&boundsLTRB=2583,1011,3086,1514&width=180&height=180&startFrame=6059&format=mp4&fps=12&tileFormat=mp4&nframes=36",
    "correct": "Good job! This one shows only cloud shadows and some steam.",
    "wrong": general_not_to_select_head + "shows only cloud shadows and some steam (no smoke).",
    "hint": "This one has only some steam and many cloud shadows, right?",
    "label": 0
  }]
}];