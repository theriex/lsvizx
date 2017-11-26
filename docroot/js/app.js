/*global window jtminjsDecorateWithUtilities */
/*jslint browser, multivar, white, fudge, for */

var app = {};  //Global container for app level funcs and values
var jt = {};   //Global access to general utility methods

app = (function () {
    "use strict";

    var lsat = null,
        searches = {},
        entities = {},
        dispid = "";


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
            updateDisplay(); }
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
        var cv, prios = ["search", "relationships", "details"];
        //Will probably get string ids back to avoid exceeding javascript
        //integer values, but verify here just to enforce as a standard.
        ent.id = String(ent.id);
        cv = entities[ent.id];
        //Prioritized overwrites don't lose information. 
        if(!cv || (prios.indexOf(callsrc) > prios.indexOf(cv.callsrc))) {
            entities[ent.id] = ent; }
    }


    function foundEntities (sval) {
        var ents = [], eids = searches[sval] || [];
        eids.forEach(function (eid) {
            if(entities[eid]) {
                ents.push(entities[eid]); }
            else {
                jt.log("Entity " + eid + " not found"); } });
        return ents;
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
                    updateDisplay(); },
                function (code, errtxt) {
                    jt.out("detdiv", "Search error " + code + ": " + errtxt); },
                jt.semaphore("app.search"));
    }


    function getJSONDataURI () {
        var txt, ctx = { lsat:lsat, entities:entities, searches:searches,
                         dispid:dispid }
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


    function displayEntityDetails () {
        jt.log("displayEntityDetails not implemented yet");
    }


    function rebuildDisplay () {
        var as;
        if(dispid) {
            displayEntityDetails(entities[dispid]); }
        else {  //if no current entity, show whatever search results.
            as = Object.keys(searches);
            if(as.length) {
                displayNames("detdiv", foundEntities(as[0])); } }
        updateDisplay();
    }


    function loadContextData () {
        var ctx = null;
        jt.call("GET", "data/context.json", null,
                function (ld) {
                    lsat = ld.lsat;
                    searches = ld.searches;
                    entities = ld.entities;
                    dispid = ld.dispid;
                    rebuildDisplay(); },
                function (code, errtxt) {
                    jt.log("data/context.json not loaded"); },
                jt.semaphore("app.loadContextData"));
    }


    function init () {
        jtminjsDecorateWithUtilities(jt);
        lsat = jt.cookie("lsapitoken")
        showTools();
        loadContextData();
    }


    function updateDisplay () {
        showTools();
    }


    function displayEntity (entid) {
        jt.log("displayEntity not implemented yet");
    }


return {
    init: function () { init(); },
    update: function () { updateDisplay(); },
    dispent: function (entid) { displayEntity(entid); }
};
}());


