# video-labeling-tool
Demo: http://smoke.createlab.org

A tool for labeling video clips (both front-end and back-end). The back-end depends on a [thumbnail server](https://github.com/CMU-CREATE-Lab/timemachine-thumbnail-server) to provides video urls. The back-end is based on [flask](http://flask.pocoo.org/). A flask tutorial can be found on [this blog](https://blog.miguelgrinberg.com/post/the-flask-mega-tutorial-part-i-hello-world). 

### Table of Content
- [Install MySQL](#install-mysql)
- [Setup back-end](#setup-back-end)
- [Dump and import MySQL database](#dump-and-import-mysql)
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
wget https://repo.continuum.io/miniconda/Miniconda2-4.6.14-Linux-x86_64.sh
sudo sh Miniconda2-4.6.14-Linux-x86_64.sh -b -p /opt/miniconda3

sudo vim /etc/bash.bashrc
# Add the following lines to this file
export PATH="/opt/miniconda3/bin:$PATH"
. /opt/miniconda3/etc/profile.d/conda.sh

source /etc/bash.bashrc
```
For Mac OS, I recommend installing conda by using [Homebrew](https://brew.sh/).
```sh
brew cask install miniconda
echo 'export PATH="/usr/local/miniconda3/bin:$PATH"' >> ~/.bash_profile
echo '. /usr/local/miniconda3/etc/profile.d/conda.sh' >> ~/.bash_profile
source ~/.bash_profile
```
Clone this repository.
```sh
git clone https://github.com/CMU-CREATE-Lab/video-labeling-tool.git
sudo chown -R $USER video-labeling-tool
```
Create conda environment and install packages. It is important to install pip first inside the newly created conda environment.
```sh
conda create -n video-labeling-tool
conda activate video-labeling-tool
conda install pip
which pip # make sure this is the pip inside the video-labeling-tool environment
sh video-labeling-tool/back-end/install_packages.sh
```
If the environment already exists and you want to remove it before installing packages, use the following:
```sh
conda remove -n video-labeling-tool --all
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
Run server in the conda environment for development purpose.
```sh
sh development.sh
```

# <a name="dump-and-import-mysql"></a>Dump and import MySQL database
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

# <a name="deploy-back-end-using-uwsgi"></a>Deploy back-end using uwsgi
Install [uwsgi](https://uwsgi-docs.readthedocs.io/en/latest/) using conda.
```sh
conda activate video-labeling-tool
conda install -c conda-forge uwsgi
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
sudo systemctl disable video-labeling-tool
sudo systemctl stop video-labeling-tool
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
  Header set Cache-Control "max-age=60, public, must-revalidate"
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
  Header set Cache-Control "max-age=60, public, must-revalidate"
  <Directory "/[PATH]/video-labeling-tool/front-end">
    Options FollowSymLinks
    AllowOverride None
    Require all granted
  </Directory>
  ErrorLog ${APACHE_LOG_DIR}/[FRONT_END_DOMAIN].error.log
  CustomLog ${APACHE_LOG_DIR}/[FRONT_END_DOMAIN].access.log combined
</VirtualHost>
```
Use the following if you only want to access the server from an IP address with a port. Remember to tell the apache server to listen to the port number.
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
sudo chgrp www-data html
sudo chgrp www-data [CLONED_REPOSITORY]
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
  Header set Cache-Control "max-age=60, public, must-revalidate"
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
  Header set Cache-Control "max-age=60, public, must-revalidate"
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
### /api/v1/login
Log in to the system.
- Available methods: POST
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
### /api/v1/get_batch
Get a batch of videos. If the client type is not researcher, gold standards (with known labels) will be randomly placed to evaluate the label quality.
- Available methods: POST
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
### /api/v1/send_batch
Send a batch of labels back to the server.
- Available methods: POST
- Required fields:
  - "data": a list of json with video_id (returned by the /v1/get_batch) and label (0 means no, 1 means yes)
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
### /api/v1/set_label_state
Set the states of video labels. This call is only available for reseachers with valid user tokens.
- Available methods: POST
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
### /api/v1/get_pos_labels
Get videos with positive labels. You can also query videos that were labeled positive by a user id. If a user token is provided and the client type is expert or researcher, the returned data will contain more information.
- Available methods: GET, POST
- Optional fields:
  - "user_id": obtained from the decoded user_token, which is a JWT (JSON Web Token)
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
```
