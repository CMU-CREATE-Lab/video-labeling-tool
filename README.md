# video-labeling-tool
Demo: http://smoke.createlab.org

A tool for labeling video clips (both front-end and back-end). The back-end depends on an Apache server to provide video links. The back-end is based on [flask](http://flask.pocoo.org/). A flask tutorial can be found on [this blog](https://blog.miguelgrinberg.com/post/the-flask-mega-tutorial-part-i-hello-world). If you found this code useful, we would greatly appreciate it if you could cite our technical report below:

Yen-Chia Hsu, Ting-Hao (Kenneth) Huang, Ting-Yao Hu, Paul Dille, Sean Prendi, Ryan Hoffman, Anastasia Tsuhlares, Jessica Pachuta, Randy Sargent, and Illah Nourbakhsh. 2021. Project RISE: Recognizing Industrial Smoke Emissions. Proceedings of the AAAI Conference on Artificial Intelligence (AAAI 2021). https://ojs.aaai.org/index.php/AAAI/article/view/17739

The system defines the final label by aggregating answers from citizens and researchers. At least two volunteers or one researcher will review each video. If the answers from the two volunteers agree, the system marks the video according to the agreement. Otherwise, another volunteer or researcher will review the video, and the result is aggregated based on majority voting.

This tool is tested and worked on:
- macOS Mojave
  - Chrome 77
  - Safari 12
  - Firefox 68
- Windows 10
  - Chrome 77
  - Firefox 68
  - Edge 44
- Android 7, 8, 9, and 10
  - Chrome 77
  - Firefox 68
- iOS 12 and 13
  - Chrome 77
  - Safari
  - Firefox 18

### Table of Content
- [Install MySQL](#install-mysql)
- [Setup back-end](#setup-back-end)
- [Prepare gold standards for quality check](#prepare-gold-standards)
- [Dump, import, and backup MySQL database](#dump-and-import-mysql)
- [Deploy back-end using uwsgi](#deploy-back-end-using-uwsgi)
- [Connect uwsgi to apache](#connect-uwsgi-to-apache)
- [Setup front-end on apache](#setup-front-end-on-apache)
- [Setup https (instead of using http)](#setup-https)
- [API calls](#api-calls)

# <a name="install-mysql"></a>Install MySQL
Install and start mysql database. This assumes that Ubuntu is installed. A tutorial can be found on [this blog](https://www.digitalocean.com/community/tutorials/how-to-install-mysql-on-ubuntu-18-04).
```sh
sudo apt-get install mysql-server
sudo apt-get install libmysqlclient-dev
```
For Mac OS, I recommend installing mysql by using [Homebrew](https://brew.sh/).
```sh
brew install mysql
```
After installation, run the security script.
```sh
sudo mysql_secure_installation
```
If error occurs, it is likely that mysql server did not start. Run the followings to start mysql.
```sh
# For linux
sudo service mysql start

# For mac
brew services start mysql
```
Set the user name and password for the application. Replace [DATABASE_USERNAME] and [DATABASE_PASSWORD] with your desired database user name and password respectively.
```sh
sudo mysql -u root -p
# Run the followings in the mysql shell
CREATE USER '[DATABASE_USERNAME]'@'localhost' IDENTIFIED BY '[DATABASE_PASSWORD]';
GRANT ALL PRIVILEGES ON *.* TO '[DATABASE_USERNAME]'@'localhost' WITH GRANT OPTION;
```
Create the database in the mysql shell.
```sh
# If on the production server
create database video_labeling_tool_production;

# If on the development server or your local computer
create database video_labeling_tool_development;
```
If the database exists, drop it and then create it again in the mysql shell.
```sh
# For droping database on the production server
drop database video_labeling_tool_production;

# For droping database on the development server or your local computer
drop database video_labeling_tool_development;
```

# <a name="setup-back-end"></a>Setup back-end
Install conda. This assumes that Ubuntu is installed. A detailed documentation is [here](https://conda.io/projects/conda/en/latest/user-guide/install/index.html). First visit [here](https://conda.io/miniconda.html) to obtain the downloading path. The following script install conda for all users:
```sh
wget https://repo.continuum.io/miniconda/Miniconda3-4.7.12.1-Linux-x86_64.sh
sudo sh Miniconda3-4.7.12.1-Linux-x86_64.sh -b -p /opt/miniconda3

sudo vim /etc/bash.bashrc
# Add the following lines to this file
export PATH="/opt/miniconda3/bin:$PATH"
. /opt/miniconda3/etc/profile.d/conda.sh

source /etc/bash.bashrc
```
For Mac OS, I recommend installing conda by using [Homebrew](https://brew.sh/).
```sh
brew cask install miniconda
echo 'export PATH="/usr/local/Caskroom/miniconda/base/bin:$PATH"' >> ~/.bash_profile
echo '. /usr/local/Caskroom/miniconda/base/etc/profile.d/conda.sh' >> ~/.bash_profile
source ~/.bash_profile
```
Clone this repository and set the permission.
```sh
git clone https://github.com/CMU-CREATE-Lab/video-labeling-tool.git
sudo chown -R $USER video-labeling-tool/
sudo addgroup [group_name]
sudo usermod -a -G [group_name] [user_name]
groups [user_name]
sudo chmod -R 775 video-labeling-tool/
sudo chgrp -R [group_name] video-labeling-tool/
```
Create conda environment and install packages. It is important to install pip first inside the newly created conda environment.
```sh
conda create -n video-labeling-tool
conda activate video-labeling-tool
conda install python=3.7
conda install pip
which pip # make sure this is the pip inside the video-labeling-tool environment
sh video-labeling-tool/back-end/install_packages.sh
```
If the environment already exists and you want to remove it before installing packages, use the following:
```sh
conda env remove -n video-labeling-tool
```
Create a text file with name "google_signin_client_id" in the "back-end/data/" directory to store the client ID. For detailed documentation about how to obtain the client ID, refer to the [Google Sign-In API](https://developers.google.com/identity/sign-in/web/sign-in). In the Google Cloud Console, remember to go to "APIs & Services" -> "Credentials" and add the desired domain names (or IP addresses) to the "Authorized JavaScript origins" in the OAuth client. This makes it possible to call the Google Sign-In API from these desired domains.
```sh
sudo vim video-labeling-tool/back-end/data/google_signin_client_id
# Add the following line to this file, obtained from the Google Sign-In API
XXXXXXXX.apps.googleusercontent.com
```
Create a text file with name "db_url" to store the database url in the "back-end/data/" directory. For the url format, refer to [the flask-sqlalchemy documentation](http://flask-sqlalchemy.pocoo.org/2.3/config/#connection-uri-format). Replace [DATABASE_USERNAME] and [DATABASE_PASSWORD] with the database user name and password respectively.
```sh
sudo vim video-labeling-tool/back-end/data/db_url
# Add the following line to this file (if on the production server)
mysql://[DATABASE_USERNAME]:[DATABASE_PASSWORD]@localhost/video_labeling_tool_production

# Add the following line to this file (if on the development server)
mysql://[DATABASE_USERNAME]:[DATABASE_PASSWORD]@localhost/video_labeling_tool_development
```
Generate the server private key. This will add a file "private_key" in the "back-end/data/" directory. The private key is used to sign the JWT (JSON Web Token) issued by the server.
```sh
cd video-labeling-tool/back-end/www/
python gen_key.py confirm
```
Create and upgrade the database by using the migration workfow documented on the [flask-migrate](https://flask-migrate.readthedocs.io/en/latest/) website. [This blog](https://www.patricksoftwareblog.com/tag/flask-migrate/) also provides a tutorial. The script "db.sh" enhances the workflow by adding the FLASK_APP environment.
```sh
sh db.sh upgrade
```
Here are some other migration commands that can be useful. You do not need to run these for normal usage.
```sh
# Generate the migration directory
sh db.sh init

# Generate the migration script
sh db.sh migrate "initial migration"

# Downgrade the database to a previous state
sh db.sh downgrade
```
Add testing videos (optional) or your own videos.
```sh
python add_video_set_small.py confirm
python add_video_set_large.py confirm
```
We use a "add_community_videos.py" script to generate video clips, based on the panorama video on the [BreatheCam page](http://mon.createlab.org/). See the docstring in the script for more details. Note that the system uses the following folder structure to store videos:
```
└── front-end                            # this corresponds to video-labeling-tool/front-end/
    └── videos
        ├── 180                          # the resolution of the video
        │    ├── 2018-05-11              # the video date
        │    │   ├── 0-0                 # the video view ID
        │    │   │   ├── [VID_1].mp4     # video file
        │    │   │   ├── ...             # other video files
        │    │   │   └── ...
        │    │   ├── ...                 # other video view IDs
        │    │   └── ...
        │    ├── ...                     # other video dates
        │    └── ...
        ├── 320                          # another resolution of the video
        │    ├── ...                     # similar structure
```
Run server in the conda environment for development purpose.
```sh
sh development.sh
```

# <a name="prepare-gold-standards"></a>Prepare gold standards for quality check
The system uses gold standards (videos with known labels) to check the quality of each labeled batch. If a user did not label the gold standards correctly, the corresponding batch would be discarded. Initially, there are no gold standards, and the backend will not return videos for labeling. To solve this issue, give yourself the researcher permission by using
```sh
python set_client_type.py [user_id] 0
```
where user_id can be found on the "Account" tab on the top right of the "label.html" page after logging in with Google. The number 0 that follows the user_id is the researcher permission. For more information about the permission, please refer to the client_type variable in the "User" class in the "application.py" file. The system will not run the quality check for users with the researcher permission. In this way, you can start labeling first.

To assign gold standards videos, go to the "gallery.html" page when logging in with the account that has the researcher permission. On the gallery, you will find "P*" and "N*" buttons. Clicking on these buttons shows the positive and negative videos that the researcher labeled. You can now use the dropdown below each video to change the label to Gold Pos (positive gold standards) or Gold Neg (negative gold standards). Once there is a sufficient number of gold standards (more than 4), normal users will be able to label videos. I recommend having at least 100 gold standards to start.

If you found that some videos are not suitable for labeling (e.g., due to incorrect image stitching), you can get the url of the video and use the following command to mark similar ones (with the same date and bounding box) as "bad" videos. This process does not remove videos. Instead it gives all bad videos a label state -2.
```sh
python mark_bad_videos.py [video_url]
```

# <a name="dump-and-import-mysql"></a>Dump, import, and backup MySQL database
This section assumes that you want to dump the production database to a file and import it to the development database. First, SSH to the production server and dump the database to the /tmp/ directory.
```sh
ssh [USER_NAME_PRODUCTION]@[SERVER_ADDRESS_PRODUCTION]
sudo mysqldump -u root -p video_labeling_tool_production >/tmp/video_labeling_tool_production.out
exit
```
SSH to the development server and get the dumped database file from the production server.
```sh
ssh [USER_NAME_DEVELOPMENT]@[SERVER_ADDRESS_DEVELOPMENT]
rsync -av [USER_NAME_PRODUCTION]@[SERVER_ADDRESS_PRODUCTION]:/tmp/video_labeling_tool_production.out /tmp/

# For specifying a port number
rsync -av -e "ssh -p [PORT_NUMBER]" [USER_NAME_PRODUCTION]@[SERVER_ADDRESS_PRODUCTION]:/tmp/video_labeling_tool_production.out /tmp/
```
Import the dumped production database file to the development database.
```sh
sudo mysql -u root -p
drop database video_labeling_tool_development;
create database video_labeling_tool_development;
exit
sudo mysql -u root -p video_labeling_tool_development </tmp/video_labeling_tool_production.out
```
We provide a script to backup the database:
```sh
# For the production database
sh video-labeling-tool/back-end/www/backup_db.sh production

# For the development database
sh video-labeling-tool/back-end/www/backup_db.sh development
```
You can also use crontab to backup the database automatically:
```sh
sudo crontab -e

# Add the following line for the production database
0 0 * * * cd /var/www/smoke-detection/video-labeling-tool/back-end/data/db_backup; sh ../../www/backup_db.sh production

# Add the following line for the development database
0 0 * * * cd /var/www/smoke-detection/video-labeling-tool/back-end/data/db_backup; sh ../../www/backup_db.sh development
```
# <a name="deploy-back-end-using-uwsgi"></a>Deploy back-end using uwsgi
Install [uwsgi](https://uwsgi-docs.readthedocs.io/en/latest/) using conda.
```sh
conda activate video-labeling-tool
conda install -c conda-forge uwsgi=2.0.18
```
Run the uwsgi server to check if it works.
```sh
sh production.sh
curl localhost:8080
# Should get the "Hello World!" message
```
The server log is stored in the "back-end/log/uwsgi.log" file. Refer to the "back-end/www/uwsgi.ini" file for details. The documentation is on the [uwsgi website](https://uwsgi-docs.readthedocs.io/en/latest/Configuration.html). A custom log is stored in the "back-end/log/app.log" file.
```sh
# Keep printing the log files when updated
tail -f ../log/uwsgi.log
tail -f ../log/app.log
```
Create a service on Ubuntu, so that the uwsgi server will start automatically after rebooting the system. Replace [PATH] with the path to the cloned repository. Replace [USERNAME] with your user name on Ubuntu.
```sh
sudo vim /etc/systemd/system/video-labeling-tool.service
# Add the following line to this file
[Unit]
Description=uWSGI instance to serve video-labeling-tool
After=network.target

[Service]
User=[USERNAME]
Group=www-data
WorkingDirectory=/[PATH]/video-labeling-tool/back-end/www
Environment="PATH=/home/[USERNAME]/.conda/envs/video-labeling-tool/bin"
ExecStart=/home/[USERNAME]/.conda/envs/video-labeling-tool/bin/uwsgi --ini uwsgi.ini

[Install]
WantedBy=multi-user.target
```
Register the uwsgi server as a service on Ubuntu.
```sh
sudo systemctl enable video-labeling-tool
sudo systemctl start video-labeling-tool

# Check the status of the service
sudo systemctl status video-labeling-tool

# Restart the service
sudo systemctl restart video-labeling-tool

# Stop and disable the service
sudo systemctl stop video-labeling-tool
sudo systemctl disable video-labeling-tool
```
Check if the service work.
```sh
curl localhost:8080
# Should get the "Hello World!" message
```

# <a name="connect-uwsgi-to-apache"></a>Connect uwsgi to apache
Obtain domains from providers such as [Google Domains](https://domains.google/) or [Namecheap](https://www.namecheap.com/) for both the back-end and the front-end. Point these domain names to the domain of the Ubuntu machine. Then install apache2 and enable mods.
```sh
sudo apt-get install apache2
sudo apt-get install apache2-dev

sudo a2enmod headers
sudo a2enmod rewrite
sudo a2enmod ssl
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod proxy_balancer
sudo a2enmod lbmethod_byrequests
```
Create an apache virtual host as a reverse proxy for the uwsgi server. Replace [BACK_END_DOMAIN] and [FRONT_END_DOMAIN] with your domain name for the back-end and the front-end respectively.
```sh
sudo vim /etc/apache2/sites-available/[BACK_END_DOMAIN].conf
# Add the following lines to this file
<VirtualHost *:80>
  ServerName [BACK_END_DOMAIN]
  Header always set Access-Control-Allow-Origin "http://[FRONT_END_DOMAIN]"
  Header set Access-Control-Allow-Headers "Content-Type"
  Header set Cache-Control "max-age=5, public, must-revalidate"
  ProxyPreserveHost On
  ProxyRequests Off
  ProxyVia Off
  ProxyPass / http://127.0.0.1:8080/
  ProxyPassReverse / http://127.0.0.1:8080/
  ErrorLog ${APACHE_LOG_DIR}/[BACK_END_DOMAIN].error.log
  CustomLog ${APACHE_LOG_DIR}/[BACK_END_DOMAIN].access.log combined
</VirtualHost>
```
Create a symlink of the virtual host and restart apache.
```sh
cd /etc/apache2/sites-enabled/
sudo ln -s ../sites-available/[BACK_END_DOMAIN].conf
sudo systemctl restart apache2
```

# <a name="setup-front-end-on-apache"></a>Setup front-end on apache
Create an apache virtual host. Replace [FRONT_END_DOMAIN] with your domain name for the front-end. Replace [PATH] with the path to the cloned repository.
```sh
sudo vim /etc/apache2/sites-available/[FRONT_END_DOMAIN].conf
# Add the following lines to this file
<VirtualHost *:80>
  ServerName [FRONT_END_DOMAIN]
  DocumentRoot /[PATH]/video-labeling-tool/front-end
  Header always set Access-Control-Allow-Origin "*"
  Header set Cache-Control "max-age=5, public, must-revalidate"
  <Directory "/[PATH]/video-labeling-tool/front-end">
    Options FollowSymLinks
    AllowOverride None
    Require all granted
  </Directory>
  ErrorLog ${APACHE_LOG_DIR}/[FRONT_END_DOMAIN].error.log
  CustomLog ${APACHE_LOG_DIR}/[FRONT_END_DOMAIN].access.log combined
</VirtualHost>
```
Use the following if you only want to access the server from an IP address with a port (e.g., http://192.168.1.72:8080). Remember to tell the apache server to listen to the port number.
```sh
sudo vim /etc/apache2/sites-available/video-labeling-tool-front-end.conf
# Add the following lines to this file
<VirtualHost *:8080>
  ServerAdmin webmaster@localhost
  DocumentRoot /[PATH]/video-labeling-tool/front-end
  ErrorLog ${APACHE_LOG_DIR}/video-labeling-tool-front-end.error.log
  CustomLog ${APACHE_LOG_DIR}/video-labeling-tool-front-end.access.log combined
</VirtualHost>

sudo vim /etc/apache2/ports.conf
# Add the following lines to this file
Listen 8080
```
Create a symlink of the virtual host and restart apache.
```sh
cd /etc/apache2/sites-enabled/
sudo ln -s ../sites-available/[FRONT_END_DOMAIN].conf
sudo systemctl restart apache2
```

# <a name="setup-https"></a>Setup https (instead of using http)
Go to https://certbot.eff.org/ and follow the instructions to install Certbot on the Ubuntu server. Then run the following to enable Apache2 mods.
```sh
sudo a2enmod headers
sudo a2enmod rewrite
sudo a2enmod ssl
```
Give permissions so that the Certbot and apache can modify the website. This assumes that the cloned repository is placed under the /var/www/ directory. Replace [CLONED_REPOSITORY] with your directory name, such as video-labeling-tool.
```sh
cd /var/www/
sudo mkdir html # only run this if the html directory did not exist
sudo chmod 775 html
sudo chmod 775 [CLONED_REPOSITORY]
sudo chgrp -R www-data html
sudo chgrp -R www-data [CLONED_REPOSITORY]
```
If other users need to modify this repository, add them to the www-data group.
```sh
sudo usermod -a -G www-data [user_name]
groups [user_name]
```
Run the Certbot.
```sh
sudo certbot --apache certonly
```
Copy the directories that point to the SSL certificate and the SSL certificate key in the terminal provided by the certbot. For example:
```sh
/etc/letsencrypt/live/[...]/fullchain.pem
/etc/letsencrypt/live/[...]/privkey.pem
```
Edit apache configuration file for the back-end. Note the "https" before the FRONT_END_DOMAIN, not http.
```sh
sudo vim /etc/apache2/sites-available/[BACK_END_DOMAIN].conf
# Add the following lines to this file
<VirtualHost *:443>
  ServerName [BACK_END_DOMAIN]
  # Enable https ssl support
  SSLEngine On
  # The following line enables cors
  Header always set Access-Control-Allow-Origin "https://[FRONT_END_DOMAIN]"
  Header set Access-Control-Allow-Headers "Content-Type"
  # The following line forces the browser to break the cache
  Header set Cache-Control "max-age=5, public, must-revalidate"
  # Reverse proxy to the uwsgi server
  ProxyPreserveHost On
  ProxyRequests Off
  ProxyVia Off
  ProxyPass / http://127.0.0.1:8080/
  ProxyPassReverse / http://127.0.0.1:8080/
  # APACHE_LOG_DIR is /var/log/apache2/
  ErrorLog ${APACHE_LOG_DIR}/[BACK_END_DOMAIN].error.log
  CustomLog ${APACHE_LOG_DIR}/[BACK_END_DOMAIN].access.log combined
  # Add ssl
  SSLCertificateFile /etc/letsencrypt/live/[...]/fullchain.pem
  SSLCertificateKeyFile /etc/letsencrypt/live/[...]/privkey.pem
  Include /etc/letsencrypt/options-ssl-apache.conf
</VirtualHost>

<VirtualHost *:80>
  ServerName [BACK_END_DOMAIN]
  # Enable the url rewriting
  RewriteEngine on
  # Redirect http to https
  RewriteRule ^ https://%{SERVER_NAME}%{REQUEST_URI} [END,NE,R=permanent] 
</VirtualHost>
```
Edit apache configuration file for the front-end.
```sh
sudo vim /etc/apache2/sites-available/[FRONT_END_DOMAIN].conf
# Add the following lines to this file
<VirtualHost *:443>
  ServerName [FRONT_END_DOMAIN]
  DocumentRoot /[PATH]/video-labeling-tool/front-end
  # Enable https ssl support
  SSLEngine On
  # The following line enables cors
  Header always set Access-Control-Allow-Origin "*"
  # The following line forces the browser to break the cache
  Header set Cache-Control "max-age=5, public, must-revalidate"
  <Directory "/[PATH]/video-labeling-tool/front-end">
    Options FollowSymLinks
    AllowOverride None
    Require all granted
  </Directory>
  # APACHE_LOG_DIR is /var/log/apache2/
  ErrorLog ${APACHE_LOG_DIR}/[FRONT_END_DOMAIN].error.log
  CustomLog ${APACHE_LOG_DIR}/[FRONT_END_DOMAIN].access.log combined
  # Add ssl
  SSLCertificateFile /etc/letsencrypt/live/[...]/fullchain.pem
  SSLCertificateKeyFile /etc/letsencrypt/live/[...]/privkey.pem
  Include /etc/letsencrypt/options-ssl-apache.conf
</VirtualHost>

<VirtualHost *:80>
  ServerName [FRONT_END_DOMAIN]
  # Enable the url rewriting
  RewriteEngine on
  # Redirect http to https
  RewriteRule ^ https://%{SERVER_NAME}%{REQUEST_URI} [END,NE,R=permanent] 
</VirtualHost>
```
Restart apache server.
```sh
sudo /etc/init.d/apache2 restart
```
Set a cron job to renew the SSL certificate automatically.
```sh
sudo bash
crontab -e
```
Add the following to the crontab.
```sh
# Renew our SSL certificate
0 0 1 * * /opt/certbot-auto renew --no-self-upgrade >>/var/log/certbot.log
```
Then type "exit" in the terminal to exit the bash mode. Also remember to go to the Google API console and add https domains to the authorized JavaScript origins for the OAuth client (the Google Login API). All http urls in the front-end code (e.g., API urls, video urls) also need to be replaced with the https version.

# <a name="api-calls"></a>API calls
The following code examples assusme that the root url is http://localhost:5000.
### Log in to the system
The server will return a user token in the form of JWT (JSON Web Token). There are four different client types, as documented in the User class in [this file](back-end/www/application.py).
- Path:
  - **/api/v1/login**
- Available methods:
  - POST
- Required fields (either google_id_token or client_id):
  - "google_id_token": from [Google Sign-In](https://developers.google.com/identity/sign-in/web/sign-in)
  - "client_id": from Google Analytics id or randomly generated uuid
- Returned fields:
  - "user_token": user token for the front-end client
  - "user_token_for_other_app": user token for other applications
```JavaScript
// jQuery examples
$.ajax({
  url: "http://localhost:5000/api/v1/login",
  type: "POST",
  data: JSON.stringify({google_id_token: gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token}),
  contentType: "application/json",
  dataType: "json",
  success: function (data) {console.log(data)},
  error: function (xhr) {console.error(xhr)}
});

$.ajax({
  url: "http://localhost:5000/api/v1/login",
  type: "POST",
  data: JSON.stringify({client_id: "uuid_for_testing"}),
  contentType: "application/json",
  dataType: "json",
  success: function (data) {console.log(data)},
  error: function (xhr) {console.error(xhr)}
});
```
### Get a batch of videos
If the client type is not researcher, gold standards (with known labels) will be randomly placed to evaluate the label quality. For researchers, there will be no gold standards. Combine url_root and url_part in the returned data to get the full video URL.
- Path:
  - **/api/v1/get_batch**
- Available methods:
  - POST
- Required fields:
  - "user_token": from /api/v1/login
- Returned fields:
  - "data": video metadata
  - "video_token": video token for verification when sending the labels back to the server
```JavaScript
// jQuery examples
$.ajax({
  url: "http://localhost:5000/api/v1/get_batch",
  type: "POST",
  data: JSON.stringify({user_token: "your_user_token"}),
  contentType: "application/json",
  dataType: "json",
  success: function (data) {console.log(data)},
  error: function (xhr) {console.error(xhr)}
});
```
### Send a batch of video labels
The video token is for checking if the server issued the video batch. The label states determined by regular users and researchers are stored in two separate columns (label_state and label_state_admin) in the Video table in the database.
- Path:
  - **/api/v1/send_batch**
- Available methods:
  - POST
- Required fields:
  - "data": a list of dictionaries with video_id (returned by the /v1/get_batch) and label (0 means no, 1 means yes)
  - "user_token": from /api/v1/login
  - "video_token": from /api/v1/get_batch
- Returned fields:
  - "data": scores for the current user (null for no changes) and the labeled batch (0 for poor labeling quality)
```JavaScript
// jQuery examples
$.ajax({
  url: "http://localhost:5000/api/v1/send_batch",
  type: "POST",
  data: JSON.stringify({"video_token":"your_video_token","user_token":"your_user_token","data":[{"video_id":1,"label":0},{"video_id":2,"label":1},{"video_id":3,"label":1},{"video_id":4,"label":0},{"video_id":5,"label":0},{"video_id":6,"label":0},{"video_id":16151,"label":0},{"video_id":7,"label":1},{"video_id":8,"label":0},{"video_id":9,"label":0},{"video_id":10,"label":0},{"video_id":11,"label":0},{"video_id":12,"label":0},{"video_id":13,"label":1},{"video_id":14,"label":1},{"video_id":15,"label":0}]}),
  contentType: "application/json",
  dataType: "json",
  success: function (data) {console.log(data)},
  error: function (xhr) {console.error(xhr)}
});
```
### Set the states of video labels
This call is only available for researchers (client type 0) with valid user tokens. Any previously determined label state will be overwritten.
- Path:
  - **/api/v1/set_label_state**
- Available methods:
  - POST
- Required fields:
  - "data": a list of json with video_id (returned by the /v1/get_batch) and label state (documented in the label_state_machine function in [this file](back-end/www/application.py))
  - "user_token": from /api/v1/login
- No returned fields
```JavaScript
// jQuery examples
$.ajax({
  url: "http://localhost:5000/api/v1/set_label_state",
  type: "POST",
  data: JSON.stringify({"data":[{"video_id":1,"label":-2}],"user_token":"your_user_token"}),
  contentType: "application/json",
  dataType: "json",
  success: function (data) {console.log(data)},
  error: function (xhr) {console.error(xhr)}
});
```
### Get videos with fully or partially labeled positive or negative labels (for all users)
These calls are available for all users. When querying positive labels, you can pass in user id. If a user token is provided and the client type is expert or researcher, the returned data will contain more information. You can also get videos that have partial labels (verified by only one user or by two users with disagreement).
- Paths:
  - **/api/v1/get_pos_labels**
  - **/api/v1/get_neg_labels**
  - **/api/v1/get_maybe_pos_labels**
  - **/api/v1/get_maybe_neg_labels**
  - **/api/v1/get_discorded_labels**
- Available methods:
  - GET, POST
- Optional fields:
  - "user_id": obtained by decoding the user_token JWT
  - "page_number": default to 1
  - "page_size": default to 16, maximum 1000
  - "user_token": from /api/v1/login
- Returned fields:
  - "data": a list of video metadata
  - "total": the total number of queried videos, can be larger than the page size
```JavaScript
// jQuery examples
$.ajax({
  url: "http://localhost:5000/api/v1/get_pos_labels",
  type: "POST",
  data: "user_token=your_user_token&pageSize=16&pageNumber=1",
  contentType: "application/x-www-form-urlencoded; charset=UTF-8",
  dataType: "json",
  success: function (data) {console.log(data)},
  error: function (xhr) {console.error(xhr)}
});
```
```sh
# curl example
curl http://localhost:5000/api/v1/get_pos_labels
curl http://localhost:5000/api/v1/get_pos_labels?user_id=43
curl http://localhost:5000/api/v1/get_neg_labels
curl http://localhost:5000/api/v1/get_maybe_pos_labels
curl http://localhost:5000/api/v1/get_discorded_labels
```
### Get videos with other types of labels (for only expert and researcher type users)
These calls are only available for researchers or experts (client type 0 or 1) with valid user tokens. You can get videos that are marked as gold standards or labeled by researchers/citizens. For researchers or experts, the gallery page will be in the dashboard mode, where you can download the user token.
- Paths:
  - **/api/v1/get_pos_gold_labels**
  - **/api/v1/get_neg_gold_labels**
  - **/api/v1/get_pos_labels_by_researcher**
  - **/api/v1/get_neg_labels_by_researcher**
  - **/api/v1/get_pos_labels_by_citizen**
  - **/api/v1/get_neg_labels_by_citizen**
  - **/api/v1/get_bad_labels**
- Available methods:
  - POST
- Required fields:
  - "user_token": from /api/v1/login or the gallery page
- Optional fields:
  - "page_number": default to 1
  - "page_size": default to 16, maximum 1000
- Returned fields:
  - "data": a list of video metadata
  - "total": the total number of queried videos, can be larger than the page size
```JavaScript
// jQuery examples
$.ajax({
  url: "http://localhost:5000/api/v1/get_pos_gold_labels",
  type: "POST",
  data: "user_token=your_user_token&pageSize=16&pageNumber=1",
  contentType: "application/x-www-form-urlencoded; charset=UTF-8",
  dataType: "json",
  success: function (data) {console.log(data)},
  error: function (xhr) {console.error(xhr)}
});
```
```sh
# curl example
curl -d 'user_token=your_user_token' -H 'Content-Type: application/x-www-form-urlencoded; charset=UTF-8' -X POST http://localhost:5000/api/v1/get_pos_gold_labels
```
### Get the entire video dataset with labels
This call is only available for researchers or experts (client type 0 or 1) with valid user tokens. Notice that this call is not paginated and will take a long time to complete.
- Paths:
  - **/api/v1/get_all_labels**
- Available methods:
  - POST
- Required fields:
  - "user_token": from /api/v1/login or the gallery page
- Returned fields:
  - "data": a list of video metadata
```JavaScript
// jQuery examples
$.ajax({
  url: "http://localhost:5000/api/v1/get_all_labels",
  type: "POST",
  data: "user_token=your_user_token",
  contentType: "application/x-www-form-urlencoded; charset=UTF-8",
  dataType: "json",
  success: function (data) {console.log(data)},
  error: function (xhr) {console.error(xhr)}
});
```
```sh
# curl example
curl -d 'user_token=your_user_token' -H 'Content-Type: application/x-www-form-urlencoded; charset=UTF-8' -X POST http://localhost:5000/api/v1/get_all_labels
```
### Get the statistics of labels
Get the number of all videos, the number of fully labeled videos (confirmed by multiple users), and the number of partially labeled videos. The statistics exclude the videos that were marked as "bad" data and gold standards.
- Paths:
  - **/api/v1/get_label_statistics**
- Available methods:
  - GET
- Returned fields:
  - "num_all_videos": number of all videos (excluding bad data and gold standards)
  - "num_fully_labeled": number of fully labeled videos (excluding bad data and gold standards)
  - "num_partially_labeled": number of partially labeled videos (excluding bad data and gold standards)
```JavaScript
// jQuery examples
$.getJSON("http://localhost:5000/api/v1/get_label_statistics", function (data) {
  console.log(data);
});
```
```sh
# curl example
curl http://localhost:5000/api/v1/get_label_statistics
```
### Add a record when a user takes or passes the tutorial
When a user takes or passes the tutorial of smoke labeling, you can send a post request via this API call to add a record in the database. This call returns HTTP status 204 when succeed.
- Paths:
  - **/api/v1/add_tutorial_record**
- Available methods:
  - POST
- Required fields:
  - "user_token": from /api/v1/login or the gallery page
  - "action_type": an integer ranging from 0 to 4
    - 0: took the tutorial
    - 1: did not pass the last batch in the tutorial
    - 2: passed the last batch (16 videos) during the third try with hints
    - 3: passed the last batch during the second try after showing the answers
    - 4: passed the last batch (16 videos) in the tutorial during the first try
  - "query_type": an integer ranging from 0 to 2
    - 0: entered the tutorial page (can come from multiple sources or different button clicks)
    - 1: clicked the tutorial button on the webpage (not the prompt dialog)
    - 2: clicked the tutorial button in the prompt dialog (not the webpage)
```JavaScript
// jQuery examples
$.ajax({
  url: "http://localhost:5000/api/v1/add_tutorial_record",
  type: "POST",
  data: JSON.stringify({"user_token":"your_user_token","action_type":1,"query_type":2}),
  contentType: "application/json",
  dataType: "json",
  success: function (data) {console.log(data)},
  error: function (xhr) {console.error(xhr)}
});
```
