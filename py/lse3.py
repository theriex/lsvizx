import logging
logging.basicConfig(level=logging.DEBUG)
import urllib.request
import flask


def lscall(eps):
    lsat = flask.request.args.get("lsat", "")
    if not lsat:
        return "LittleSis API token (lsat param) required", 400
    data = None
    try:
        url = "https://littlesis.org/api/entities/" + eps
        logging.debug("opening " + url)
        req = urllib.request.Request(url)
        # Content-Type: application/x-www-form-urlencoded is assumed
        req.add_header("Littlesis-Api-Token", "KVY1yhxh7JrWCB3suHk-gA")
        req.add_header("Accept", "*/*")  # Used by curl, good to include.
        # API docs use curl examples.  The default
        # User-Agent:Python-urllib/3.7 causes a 403. ep17jan20
        req.add_header("User-Agent", "curl/7.54.0")  # Required
        res = urllib.request.urlopen(req)
        data = res.read();
    except Exception as e:
        logging.info("lscall fetch error: " + str(e))
        return "lscall fetch failure " + str(e), 503  # Service Unavailable
    return data
    

def lsesrch():
    logging.debug("Received call to lsesrch")
    qstr = flask.request.args.get("qstr", "")
    if not qstr:
        return "query string (qstr param) required", 400
    return lscall("search?q=" + urllib.parse.quote(qstr))


def lsedet():
    logging.debug("Received call to lsedet")
    entid = flask.request.args.get("entid", "")
    if not entid:
        return "entity id (entid param) required", 400
    return lscall(entid + "?details=TRUE")


def lserels():
    logging.debug("Received call to lserels")
    entid = flask.request.args.get("entid", "")
    if not entid:
        return "entity id (entid param) required", 400
    return lscall(entid + "/relationships")


def chkconn():
    logging.debug("Received call to chkconn")
    content = urllib.request.urlopen("https://epinova.com/js/testdat.json")
    return content.read();

