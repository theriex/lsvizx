/*global window jtminjsDecorateWithUtilities confirm d3 */
/*jslint browser, multivar, white, fudge, for */

var app = {};  //Global container for app level funcs and values
var jt = {};   //Global access to general utility methods

app = (function () {
    "use strict";

    var lsat = null,
        searches = {},
        entities = {},
        dispid = "",
        nodeids = [],
        vc = {};  //visualization chart vars


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
        jt.call("GET", "api/lsesrch?" + params, null,
                function (res) {
                    saveFoundEntities(sval, res);
                    displayNames("detdiv", foundEntities(sval), noes);
                    app.update(); },
                function (code, errtxt) {
                    jt.out("detdiv", "Search error " + code + ": " + errtxt); },
                jt.semaphore("app.search"));
    }


    function getJSONDataURI () {
        //Need LittleSis API Token to start and show appropriate tools, but
        //context.json file may be shared or used for other purposes where
        //it is not appropriate to be sharing the token.  Compromise is to
        //set it to a known anonymous value here.  Easy to find and edit in
        //the resulting file if needed.
        var txt, ctx = { lsat:"xxxx", entities:entities, searches:searches,
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
                                   placeholder:"LittleSis-API-Token",
                                   value:""}],
                        ["button", {type:"button", id:"apitokenbutton",
                                    cla:"toolbutton"},
                         "Enable API"]]]); }
        else {
            if(jt.byId("introtextdiv")) {
                jt.out("detdiv", ""); }
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
            jt.call("GET", "api/lsedet?" + params, null,
                    function (res) {
                        cacheEntity(res.data, "details");
                        app.update("details"); },
                    function (code, errtxt) {
                        jt.out("edtcontdiv", "Detail fetch error " + code + 
                               ": " + errtxt);
                        jt.byId("edtcontdiv").style.display = "block"; },
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


    function parseNamesFromDesc (rel) {
        //The description is constructed automatically by the API, and the
        //components of the description are very helpfully delimited by a
        //double space.  This is not visible in html, but it helps
        //enormously when dealing with raw JSON text values.
        var names = {}, des = rel.attributes.description.split("  ");
        // var stopids = ["257422"];
        // if((stopids.indexOf(rel.id) >= 0) ||
        //    (stopids.indexOf(rel.attributes.entity1_id) >= 0) ||
        //    (stopids.indexOf(rel.attributes.entity2_id) >= 0)) {
        //     jt.err("parseNamesFromDesc stopid found"); }
        names.inbound = des[0];
        names.outbound = des[2];
        if(names.outbound.indexOf(") at") >= 0 && des.length >= 4) {
            names.outbound = des[3]; }
        return names;
    }


    function cacheRelationships (rels, ent) {
        ent.rels = {inbound:[], outbound:[]};
        rels.forEach(function (rel) {
            var re = {}, relnames;
            //Should get string ids back from server to avoid overflowing
            //javascript integer values.  Verify here to enforce as a standard.
            rel.id = String(rel.id);
            rel.attributes.entity1_id = String(rel.attributes.entity1_id);
            rel.attributes.entity2_id = String(rel.attributes.entity2_id);
            relnames = parseNamesFromDesc(rel);
            if(rel.attributes.entity1_id === ent.id) {
                re.id = rel.attributes.entity2_id;
                re.attributes = {name:relnames.outbound,
                                 blurb:(rel.attributes.description2 ||
                                        rel.attributes.description1 ||
                                        rel.attributes.description)};
                if(!ent.rels.outbound.find(function (existing) {
                    return existing.entid === re.id; })) {
                    ent.rels.outbound.push({entid:re.id, relid:rel.id,
                                            desc:re.attributes.blurb}); } }
            else {
                re.id = rel.attributes.entity1_id;
                re.attributes = {name:relnames.inbound,
                                 blurb:(rel.attributes.description1 ||
                                        rel.attributes.description2 ||
                                        rel.attributes.description)};
                if(!ent.rels.inbound.find(function (existing) {
                    return existing.entid === re.id; })) {
                    ent.rels.inbound.push({entid:re.id, relid:rel.id,
                                           desc:re.attributes.blurb}); } }
            re.attributes.primary_ext = "Placeholder";
            cacheEntity(re, "relationships"); });
    }


    function displayCachedRelationships (rels) {
        displayNames("edcirdiv", entIdArrayToEnts(
            rels.inbound.map(function (rel) { return rel.entid; })));
        displayNames("edcordiv", entIdArrayToEnts(
            rels.outbound.map(function (rel) { return rel.entid; })));
    }


    function displayRelationships (entid) {
        var params, ent = entities[entid];
        if(ent.rels) {
            displayCachedRelationships(ent.rels);
            return; }
        if(ent.attributes.primary_ext === "Placeholder") {
            return; }  //wait for details before fetching rels
        params = "lsat=" + lsat + "&entid=" + entid;
        jt.call("GET", "api/lserels?" + params, null,
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
        ent.lastviewed = Date.now();  //used for heat chromacoding
        if(nodeids.indexOf(entid) < 0) {
            nodeids.push(entid); }
        html = ["div", {id:"entdetdiv"},
                [["div", {id:"edtdiv"},
                  [["div", {id:"edtnamediv"},
                    ["div", {id:"edtnamelinkdiv"},
                     [["a", {href:"#" + entid,
                             onclick:jt.fs("app.togdisp('edtcontdiv')"),
                             title:"Toggle detail display"},
                       ent.attributes.name],
                      ["span", {id:"detxspan"}]]]],
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
        if(nodeids.length > 2) {
            jt.out("detxspan", jt.tac2html(
                ["&nbsp;",
                 ["a", {href:"#remove", 
                        onclick:jt.fs("app.undisp('" + entid + "')")},
                  ["img", {src:"img/trash.png", cla:"noderemoveimg"}]]])); }
        displayRelationships(entid);
    }


    function shortname (node) {
        var sn = node.attributes.name || "unknown";
        sn = sn.replace(/Political\sAction\sCommittee/ig, "PAC");
        return sn;
    }


    function findRelationship (src, trg, dir) {
        var rel;
        if(src === trg || !src.rels || !src.rels[dir]) {
            return null; }
        rel = src.rels[dir].find(function (rel) {
            return rel.entid === trg.id; });
        return rel;
    }


    function rebuildChartData () {
        vc.dat = {nodes:[], links:[]};
        nodeids.forEach(function (nodeid) {
            //nodes are color coded red to black based on lastviewed recency
            vc.dat.nodes.push(entities[nodeid]); });
        vc.dat.nodes.forEach(function (src) {
            vc.dat.nodes.forEach(function (trg) {
                var rel = findRelationship(src, trg, "outbound");
                if(rel) {
                    vc.dat.links.push({source:src.id, target:trg.id,
                                       value:1, desc:rel.desc, 
                                       relid:rel.relid}); }
                rel = findRelationship(src, trg, "inbound");
                if(rel) {
                    vc.dat.links.push({source:trg.id, target:src.id,
                                       value:1, desc:rel.desc,
                                       relid:rel.relid}); } }); });
    }


    function calcChartHeight () {
        var maxh = Math.round(0.5 * window.innerHeight),
            //figure a logical "lines" count based on how many nodes can
            //coexist comfortably next to each other in the display.
            //Started out at 3, but relationship descriptions can get quite
            //long, which requires more vertical space to be legible.
            linec = Math.round(nodeids.length / 2) + 1,
            lineh = 50;  //min line height in px
        return Math.min(maxh, linec * lineh);
    }


    function linemid (d, c) {
        var a = d.source[c],
            b = d.target[c],
            mid = Math.round((a + b) / 2);
        if(c === "y") {
            mid += 6; }
        return mid;
    }


    function ticked () {  //reflect the force updated values in the display
        vc.dat.nodes.forEach(function (node) {
            if(node.poslocked) {
                node.x = node.poslocked.x;
                node.y = node.poslocked.y; } });
        vc.link
            .attr("x1", function (d) { return d.source.x; })
            .attr("y1", function (d) { return d.source.y; })
            .attr("x2", function (d) { return d.target.x; })
            .attr("y2", function (d) { return d.target.y; });
        vc.lls
            .attr("x", function (d) { return linemid(d, "x"); })
            .attr("y", function (d) { return linemid(d, "y"); });
        vc.node
            .attr("cx", function (d) { return d.x; })
            .attr("cy", function (d) { return d.y; });
        vc.nls
            .attr("x", function (d) { return d.x + 8; })
            .attr("y", function (d) { return d.y + 4; });
        //jt.log("ticked " + Date.now());
    }


    function dragstarted (d) {
        if(!d3.event.active) {
            vc.sim.alphaTarget(0.3).restart(); }
        d.fx = d.x;
        d.fy = d.y;
    }


    function dragged (d) {
        d.fx = d3.event.x;
        d.fy = d3.event.y;
    }


    function dragended (d) {
        if(!d3.event.active) {
            vc.sim.alphaTarget(0); }
        d.fx = null;
        d.fy = null;
        if(!d.poslocked) {
            d.poslocked = {x:d.x, y:d.y}; }
        else {
            d.poslocked = null; }
    }


    function drawLabels () {
        vc.nls = vc.svg.append("g")
            .attr("class", "nodelabels")
            .selectAll("#nodelabel")
            .data(vc.dat.nodes)
            .enter().append("text")
            .attr("class", "nodelabel")
            .text(function (d) { return shortname(d); });
        vc.lls = vc.svg.append("g")
            .attr("class", "linklabels")
            .selectAll("#linklabel")
            .data(vc.dat.links)
            .enter().append("text")
            .attr("class", "linklabel")
            .text(function (d) { return d.desc || "----"; });
    }


    function drawChartElements () {
        drawLabels();
        vc.link = vc.svg.append("g")
            .attr("class", "links")
            .selectAll("line")
            .data(vc.dat.links)
            .enter().append("line")
        //using the square root lets the lines get thicker as the values
        //increase, but without getting too thick.
            .attr("stroke-width", function (d) { 
                return Math.sqrt(d.value) + 1; });
        vc.node = vc.svg.append("g")
            .attr("class", "nodes")
            .selectAll("circle")
            .data(vc.dat.nodes)
            .enter().append("circle")
            .attr("r", 5)
            .attr("fill", function (d) { return vc.color(d.lastviewed); })
            .call(d3.drag()
                  .on("start", dragstarted)
                  .on("drag", dragged)
                  .on("end", dragended))
            .on("click", function (d) { 
                dispid = d.id;
                d.lastviewed = Date.now();  //used for heat chromacoding
                app.update("all"); });
        vc.node.append("title")
            .text(function (d) { return shortname(d); });
        vc.sim.nodes(vc.dat.nodes).on("tick", ticked);
        vc.sim.force("link").links(vc.dat.links);
    }


    function displayChart () {
        if(!nodeids || nodeids.length < 2) {
            return; }  //must have at least two connected points
        vc.dims = {w:window.innerWidth, h:calcChartHeight()};
        jt.out("vcdiv", jt.tac2html(
            ["svg", {id:"vcsvg", width:vc.dims.w, height:vc.dims.h}]));
        vc.svg = d3.select("svg");
        vc.color = d3.scaleLinear()
            .domain(d3.extent(entIdArrayToEnts(nodeids), function (d) {
                return d.lastviewed; }))
            .interpolate(d3.interpolateHcl)
            .range([d3.rgb("#330000"), d3.rgb("#FF0000")]);
        vc.sim = d3.forceSimulation()
            .force("link", d3.forceLink().id(function(d) { return d.id; }))
            .force("charge", d3.forceManyBody())
            .force("center", d3.forceCenter(vc.dims.w / 2, vc.dims.h / 2));
        drawChartElements();
    }


    function createChart () {
        rebuildChartData();
        displayChart();
    }


    function rebuildDisplay () {
        var as;
        //It's a lot of computer work to recreate the display from scratch,
        //but rebuilding provides some display consistency when returning to
        //a visualization later.  If the display were built additively, a
        //rebuild later could likely cause layout change annoyance.
        jt.out("vcdiv", "");  //clear any existing visualization chart
        if(nodeids.length) {
            createChart(); }
        jt.out("detdiv", "");  //clear any existing details display
        if(dispid) {
            displayEntityDetails(dispid); }
        else {  //if no current entity, show whatever search results.
            as = Object.keys(searches);
            if(as.length) {
                displayNames("detdiv", foundEntities(as[0])); } }
        app.update();
    }


    function checkConnectivity () {
        jt.call("GET", "api/chkconn", null,
                function (res) {
                    var link = res.contacturl;
                    jt.out("contactdiv", jt.tac2html(
                        ["contact:",
                         ["a", {href:link, onclick:jt.fs("window.open('" +
                                                         link + "')")},
                          link]])); },
                function (code, errtxt) {
                    jt.err("checkConnectivity " + code + ": " + errtxt); },
                jt.semaphore("app.checkConnectivity"));
    }


    function loadContextData (loadstatic) {
        if(loadstatic && window.location.href.indexOf(":8080") > 0) {
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


    function externalLinkClick (event) {
        var src;
        jt.evtend(event);
        src = event.target || event.srcElement;
        if(src) {
            window.open(src.href); }
    }


    function externalizeLinks () {
        var links = document.getElementsByTagName("a");
        Array.prototype.forEach.call(links, function (link) {
            var href = link.href;
            if(href.indexOf("http") === 0 && 
               (((href.indexOf("8080") < 0) && (href.indexOf("lsvizx") < 0)) ||
                (href.indexOf("github") > 0))) {
                jt.on(link, "click", externalLinkClick); } });
    }


    function init () {
        jtminjsDecorateWithUtilities(jt);
        externalizeLinks();
        lsat = jt.cookie("lsapitoken");
        showTools();
        checkConnectivity();
        loadContextData(false);  //true preloads static data for testing
    }


    function updateDisplay (area) {
        showTools();
        if(area === "details" || area === "all") {
            rebuildDisplay(); }
    }


    function removeEntityFromDisplay (entid) {
        var idx = nodeids.indexOf(entid);
        if(idx >= 0) {
            nodeids.splice(idx, 1); }
        dispid = nodeids[0];
        rebuildDisplay();
    }


return {
    init: function () { init(); },
    update: function (area) { updateDisplay(area); },
    dispent: function (entid) { displayEntityDetails(entid); },
    togdisp: function (divid) { toggleDisplay(divid); },
    undisp: function (entid) { removeEntityFromDisplay(entid); }
};
}());

