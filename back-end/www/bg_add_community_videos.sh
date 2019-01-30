sudo screen -X quit
sudo rm screenlog.0

# For python in conda env
sudo screen -dmSL "add_videos" bash -c "export PATH='/opt/miniconda3/bin:$PATH'; . '/opt/miniconda3/etc/profile.d/conda.sh'; conda activate video-labeling-tool; python add_community_videos.py"

sudo screen -ls
