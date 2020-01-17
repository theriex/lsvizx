from flask import Flask
import py.lse3 as lse

# Unless app.yaml has an entrypoint, AppEngine looks for "app" in main.py
app = Flask(__name__)

######################################################################
##  API:
##  Most calls must pass the "lsat" param (LittleSis API Token)

@app.route('/api/lsesrch')
def lsesrch():
    ## Search for an entity by name
    ## GET params: lsat, qstr
    return lse.lsesrch()

@app.route('/api/lsedet')
def lsedet():
    ## Fetch details for entity
    ## GET params: lsat, entid
    return lse.lsedet()

@app.route('/api/lserels')
def lserels():
    ## Fetch relationships for entity
    ## GET params: lsat, entid
    return lse.lserels()

@app.route('/api/chkconn')
def chkconn():
    return lse.chkconn()


######################################################################
## Hook used only when running locally.  When deploying to GAE, a webserver
## process such as Gunicorn will serve the app.
if __name__ == '__main__':
    app.run(host='127.0.0.1', port=8080, debug=True)

