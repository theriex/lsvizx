import webapp2
import logging
from google.appengine.api import urlfetch
import urllib


def lseapi_call(handler, endpointstr):
    lsat = handler.request.get('lsat')
    if not lsat:
        handler.error(400)
        handler.response.out.write("LittleSis API token (lsat) required")
        return None
    headers = { 'Content-Type': 'application/x-www-form-urlencoded',
                "Littlesis-Api-Token": lsat }
    geturl = "https://littlesis.org/api/entities/" + endpointstr
    logging.info("lseapi_call " + geturl + "\n" + str(headers))
    result = None
    try:
        result = urlfetch.fetch(geturl, payload=None, method="GET",
                                headers=headers,
                                allow_truncated=False,
                                follow_redirects=True,
                                deadline=10,
                                validate_certificate=True)
    except Exception as e:
        logging.info("lseapi_call fetch error: " + str(e))
        handler.error(503)  # Service Unavailable
        handler.response.out.write("lseapi_call fetch failure " + str(e))
        return None
    return result.content


def write_json_response(handler, jsontxt):
    handler.response.headers['Access-Control-Allow-Origin'] = '*'
    handler.response.headers['Content-Type'] = 'application/json'
    handler.response.out.write(jsontxt)


class LSESearch(webapp2.RequestHandler):
    def get(self):
        logging.info("LSESearch called")
        qstr = self.request.get('qstr')
        if not qstr:
            self.error(400)
            self.response.out.write("query string (qstr) required")
            return
        result = lseapi_call(self, "search?q=" + qstr)
        if not result:
            return  # error already written
        # result holds array of entities with reasonable working data for each
        write_json_response(self, result)


class LSEDetails(webapp2.RequestHandler):
    def get(self):
        logging.info("LSEDetails called")
        entid = self.request.get('entid')
        if not entid:
            self.error(400)
            self.response.out.write("entity id (entid) required")
            return
        result = lseapi_call(self, entid + "?details=TRUE")
        if not result:
            return  # error already written
        # result holds single entity
        write_json_response(self, result)


class LSERelationships(webapp2.RequestHandler):
    def get(self):
        logging.info("LSERelationships called")
        entid = self.request.get('entid')
        if not entid:
            self.error(400)
            self.response.out.write("entity id (entid) required")
            return
        result = lseapi_call(self, entid + "/relationships")
        if not result:
            return  # error already written
        # result holds array of relationships
        write_json_response(self, result)
        


app = webapp2.WSGIApplication([('.*/lsesrch', LSESearch),
                               ('.*/lsedet', LSEDetails),
                               ('.*/lserels', LSERelationships)], 
                              debug=True)


