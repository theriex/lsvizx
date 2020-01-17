#!/bin/bash
# If gunicorn fails to start with [ERROR] Connection in use: ('', 8081) then
# ps -A | grep "gunicorn"
# and kill -SIGINT any leftover processes
gunicorn -b :8081 --pythonpath '../' main:app &
echo "gunicorn main process: $!"
nginx -c /general/dev/lsvizx/dloc/nginx.conf
