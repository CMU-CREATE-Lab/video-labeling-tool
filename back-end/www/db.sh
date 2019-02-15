#!/bin/sh
export FLASK_APP=application.py

if [ "$1" = "init" ]
then
  flask db init
elif [ "$1" = "migrate" ]
then
  flask db migrate -m "$2"
elif [ "$1" = "upgrade" ]
then
  flask db upgrade
elif [ "$1" = "downgrade" ]
then
  flask db downgrade
elif [ "$1" = "history" ]
then
  flask db history
fi
