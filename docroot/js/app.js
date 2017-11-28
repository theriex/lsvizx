/*global window jtminjsDecorateWithUtilities confirm */
/*jslint browser, multivar, white, fudge, for */

var app = {};  //Global container for app level funcs and values
var jt = {};   //Global access to general utility methods

app = (function () {
    "use strict";

    var lsat = null,
        searches = {},
        entities = {},
        dispid = "",
        nodeids = [];


    function apitoken (event) {
        jt.evtend(event);
        lsat = jt.byId("apitokenin").value;
        jt.cookie("lsapitoken", lsat);  //use token to preserve state
        app.update();
    }


    function cleartoken (event) {
        jt.evtend(event);
        if(confirm("Clear API token and remove cookie?")) {
            lsat = null;
            jt.cookie("lsapitoken", "", -1);
            app.update("all"); }
    }


    function entitySpanDisplayClass (ent) {
        if(ent.attributes.primary_ext === "Org") {
            return "entorgspan"; }
        return "entpersonspan";
    }


    function compare (a, b, fields) {
        fields.forEach(function (field) {
            a = a[field];
            b = b[field]; });
        if(a < b) { return -1; }
        if(a > b) { return 1; }
        return 0;
    }


    function sortEntities (des) {
        var cv = 0;
        des.sort(function (a, b) {
            //people first, then organizations
            if(a.attributes.primary_ext === "Org" &&
               b.attributes.primary_ext !== "Org") {
                return 1; }
            if(a.attributes.primary_ext !== "Org" &&
               b.attributes.primary_ext === "Org") {
                return -1; }
            //sort people based on last name, first name
            if(a.attributes.primary_ext === "Person" &&
               b.attributes.primary_ext === "Person") {
                cv = compare(a, b, ["attributes", "extensions", "Person", 
                                    "name_last"]);
                if(cv) { return cv; }
                cv = compare(a, b, ["attributes", "extensions", "Person", 
                                    "name_first"]);
                return cv; }
            //sort anything other than people directly by name
            else {
                cv = compare(a, b, ["attributes", "name"]);
                return cv; } });
    }


    function displayNames (divid, des, noes) {
        var html = [];
        des = des || [];
        noes = noes || "";
        if(!des.length) {
            jt.out(divid, noes);
            return; }
        sortEntities(des);
        des.forEach(function (ent) {
            html.push(["div", {cla: "namedispdiv"},
                       [["a", {href:"#" + ent.id,
                               onclick:jt.fs("app.dispent('" + ent.id + "')"),
                               title:ent.attributes.summary || ""},
                         ["span", {cla:entitySpanDisplayClass(ent)},
                          ent.attributes.name]],
                        "&nbsp;",
                        ["span", {cla:"blurbspan"},
                         (ent.attributes.blurb || "")]]]); });
        jt.out(divid, jt.tac2html(html));
    }


    function cacheEntity (ent, callsrc) {
        var cv;
        //Should get string ids back from server to avoid overflowing
        //javascript integer values.  Verify here to enforce as a standard.
        ent.id = String(ent.id);
        cv = entities[ent.id];
        //"search" and "details" have the same data.
        if(!cv || callsrc !== "relationships") {
            entities[ent.id] = ent; }
    }


    function entIdArrayToEnts (eids) {
        var ents = [];
        eids.forEach(function (eid) {
            if(entities[eid]) {
                ents.push(entities[eid]); }
            else {
                jt.log("Entity " + eid + " not found"); } });
        return ents;
    }


    function foundEntities (sval) {
        return entIdArrayToEnts(searches[sval] || []);
    }


    function saveFoundEntities (sval, res) {
        var eids = [];
        res.data.forEach(function (ent) {
            cacheEntity(ent, "search");
            eids.push(ent.id); });
        searches[sval] = eids;
    }


    function search (event) {
        var sval, noes = "No matching entities found";
        jt.evtend(event);
        sval = jt.byId("srchin").value;
        if(!sval) {
            return; }  //nothing to do
        if(searches[sval]) {
            displayNames("detdiv", foundEntities(sval), noes); }
        jt.log("searching for " + sval);
        var params = "lsat=" + lsat + "&qstr=" + jt.enc(sval);
        jt.call("GET", "lsesrch?" + params, null,
                function (res) {
                    saveFoundEntities(sval, res);
                    displayNames("detdiv", foundEntities(sval), noes);
                    app.update(); },
                function (code, errtxt) {
                    jt.out("detdiv", "Search error " + code + ": " + errtxt); },
                jt.semaphore("app.search"));
    }


    function getJSONDataURI () {
        var txt, ctx = { lsat:lsat, entities:entities, searches:searches,
                         dispid:dispid, nodeids:nodeids };
        txt = JSON.stringify(ctx);
        return "data:text/plain;charset=utf-8," + encodeURIComponent(txt);
    }


    function showTools () {
        var html = [], buttons = {};
        //API token entry prompt, or clear button
        if(!lsat) {
            buttons.api = true;
            html.push(["div", {id:"apitokenindiv", cla:"tbdiv"},
                       [["input", {type:"text", id:"apitokenin", size:26,
                                   placeholder:"LittleSis-API-Key",
                                   value:""}],
                        ["button", {type:"button", id:"apitokenbutton",
                                    cla:"toolbutton"},
                         "Enable API"]]]); }
        else {
            buttons.xapi = true;
            html.push(["div", {id:"clearapidiv", cla:"tbdiv"},
                       [["input", {type:"checkbox", id:"apicb", value:"active",
                                   checked:"checked"}],
                        ["label", {fo:"apicb", cla:"cblabel"}, "API"]]]); }
        //Search entities
        if(lsat) {
            buttons.search = true;
            html.push(["div", {id:"searchindiv", cla:"tbdiv"},
                       [["input", {type:"text", id:"srchin", size:26,
                                   placeholder:"Find person or corp", 
                                   value:""}],
                        ["a", {href:"#search", id:"searchbutton"},
                         ["img", {cla:"toolicon", 
                                  src:"img/search.png"}]]]]); }
        //Download link
        if(lsat && (Object.keys(searches).length > 0 ||
                    Object.keys(entities).length > 0)) {
            buttons.download = true;
            html.push(["div", {id:"downloadbuttondiv", cla:"tbdiv"},
                       ["a", {id:"downloadactionlink", href:getJSONDataURI(),
                              download:"context.json"},
                        ["img", {cla:"toolicon", src:"img/download.png"}]]]); }
        jt.out("toolsdiv", jt.tac2html(html));
        //Action connections
        if(buttons.api) {
            jt.on("apitokenin", "change", apitoken);
            jt.on("apitokenbutton", "click", apitoken); }
        if(buttons.xapi) {
            jt.on("apicb", "click", cleartoken); }
        if(buttons.search) {
            jt.on("srchin", "change", search);
            jt.on("searchbutton", "click", search); }
    }


    function toggleDisplay (divid) {
        var div = jt.byId(divid);
        if(div) {
            if(div.style.display === "none") {
                div.style.display = "block"; }
            else {
                div.style.display = "none"; } }
    }


    function getEntityDetailContentHTML (ent) {
        var html = [], params;
        if(!ent.attributes.types) {  //placeholder entity from relationships
            params = "lsat=" + lsat + "&entid=" + ent.id;
            jt.call("GET", "lsedet?" + params, null,
                    function (res) {
                        cacheEntity(res.data, "details");
                        app.update("details"); },
                    function (code, errtxt) {
                        jt.out("edtcontdiv", "Detail fetch error " + code + 
                               ": " + errtxt); },
                    jt.semaphore("app.detailfetch"));
            return ""; }
        html.push(["div", {cla:"detsummarydiv"}, 
                   ent.attributes.summary || ent.attributes.blurb || ""]);
        html.push(["div", {cla:"detlslink"},
                   [["span", {cla:"dettypesspan"},
                     ent.attributes.types.join(", ")],
                    "&nbsp;",
                    ["a", {href:ent.links.self,
                           onclick:jt.fs("window.open('" + ent.links.self + 
                                         "')")},
                     [["img", {src:"img/arrow12right.png"}],
                      "more at LittleSis"]]]]);
        return html;
    }


    function cacheRelationships (rels, ent) {
        ent.rels = {inbound:[], outbound:[]};
        rels.forEach(function (rel) {
            var re = {}, des = rel.attributes.description.split("  ");
            //Should get string ids back from server to avoid overflowing
            //javascript integer values.  Verify here to enforce as a standard.
            rel.id = String(rel.id);
            rel.attributes.entity1_id = String(rel.attributes.entity1_id);
            rel.attributes.entity2_id = String(rel.attributes.entity2_id);
            if(rel.attributes.entity1_id === ent.id) {
                re.id = rel.attributes.entity2_id;
                re.attributes = {name:des[2],
                                 blurb:rel.attributes.description2};
                if(ent.rels.outbound.indexOf(re.id) < 0) {
                    ent.rels.outbound.push(re.id); } }
            else {
                re.id = rel.attributes.entity1_id;
                re.attributes = {name:des[0],
                                 blurb:rel.attributes.description1};
                if(ent.rels.inbound.indexOf(re.id) < 0) {
                    ent.rels.inbound.push(re.id); } }
            re.attributes.primary_ext = "Placeholder";
            cacheEntity(re, "relationships"); });
    }


    function displayCachedRelationships (rels) {
        displayNames("edcirdiv", entIdArrayToEnts(rels.inbound));
        displayNames("edcordiv", entIdArrayToEnts(rels.outbound));
    }


    function displayRelationships (entid) {
        var params, ent = entities[entid];
        if(ent.rels) {
            displayCachedRelationships(ent.rels);
            return; }
        if(ent.attributes.primary_ext === "Placeholder") {
            return; }  //wait for details before fetching rels
        params = "lsat=" + lsat + "&entid=" + entid;
        jt.call("GET", "lserels?" + params, null,
                function (res) {
                    cacheRelationships(res.data, ent);
                    app.update();  //rebuild download link content
                    displayCachedRelationships(ent.rels); },
                function (code, errtxt) {
                    jt.err("Relationships load " + code + ": " + errtxt); },
                jt.semaphore("app.relationships"));
    }


    function displayEntityDetails (entid) {
        var html, ent = entities[entid];
        dispid = entid;
        if(nodeids.indexOf(entid) < 0) {
            nodeids.push(entid); }
        html = ["div", {id:"entdetdiv"},
                [["div", {id:"edtdiv"},
                  [["div", {id:"edtnamediv"},
                    ["div", {id:"edtnamelinkdiv"},
                     ["a", {href:"#" + entid,
                            onclick:jt.fs("app.togdisp('edtcontdiv')"),
                            title:"Toggle detail display"},
                      ent.attributes.name]]],
                   ["div", {id:"edtcontdiv", style:"display:none;"},
                    getEntityDetailContentHTML(ent)]]],
                 ["div", {id:"edcdiv"},
                  [["div", {id:"inboundrelsdiv", cla:"relcoldiv"},
                    [["div", {cla:"relcoltitlediv"}, "In Rels"],
                     ["div", {cla:"relcolnamesdiv", id:"edcirdiv"}]]],
                   ["div", {id:"outboundrelsdiv", cla:"relcoldiv"},
                    [["div", {cla:"relcoltitlediv"}, "Out Rels"],
                     ["div", {cla:"relcolnamesdiv", id:"edcordiv"}]]]]]]];
        jt.out("detdiv", jt.tac2html(html));
        displayRelationships(entid);
    }


    function rebuildDisplay () {
        var as;
        jt.out("detdiv", "");  //clear any existing display
        if(dispid) {
            displayEntityDetails(dispid); }
        else {  //if no current entity, show whatever search results.
            as = Object.keys(searches);
            if(as.length) {
                displayNames("detdiv", foundEntities(as[0])); } }
        app.update();
    }


    function loadContextData () {
        if(window.location.href.indexOf(":8080") > 0) {
            jt.call("GET", "data/context.json", null,
                    function (ld) {
                        lsat = ld.lsat;
                        searches = ld.searches || {};
                        entities = ld.entities || {};
                        dispid = ld.dispid || "";
                        nodeids = ld.nodeids || [];
                        rebuildDisplay(); },
                    function (/*code, errtxt*/) {
                        jt.log("data/context.json not loaded"); },
                    jt.semaphore("app.loadContextData")); }
    }


    function init () {
        jtminjsDecorateWithUtilities(jt);
        lsat = jt.cookie("lsapitoken");
        showTools();
        loadContextData();
    }


    function updateDisplay (area) {
        showTools();
        if(area === "details" || area === "all") {
            rebuildDisplay(); }
    }


return {
    init: function () { init(); },
    update: function (area) { updateDisplay(area); },
    dispent: function (entid) { displayEntityDetails(entid); },
    togdisp: function (divid) { toggleDisplay(divid); }
};
}());


