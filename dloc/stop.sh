#!/bin/bash
# Using -SIGINT complains.  Using equivalent -2 instead
kill -SIGINT $(ps -A | grep "gunicorn" | head -1 | cut -d' ' -f 1)
nginx -s quit
