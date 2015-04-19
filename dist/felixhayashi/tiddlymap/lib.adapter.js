/*\

title: $:/plugins/felixhayashi/tiddlymap/adapter.js
type: application/javascript
module-type: library

@module TiddlyMap
@preserve

\*/
(function(){var e=require("$:/plugins/felixhayashi/tiddlymap/utils.js").utils;var t=require("$:/plugins/felixhayashi/tiddlymap/view_abstraction.js").ViewAbstraction;var i=require("$:/plugins/felixhayashi/tiddlymap/edgetype.js").EdgeType;var r=require("$:/plugins/felixhayashi/vis/vis.js");var s=require("$:/core/modules/macros/contrastcolour.js").run;var o=function(){this.wiki=$tw.wiki;this.opt=$tw.tmap.opt;this.logger=$tw.tmap.logger};o.prototype.deleteEdge=function(e){return this._processEdge(e,"delete")};o.prototype.deleteEdges=function(t){t=e.convert(t,"array");for(var i=0;i<t.length;i++){this.deleteEdge(t[i])}};o.prototype.insertEdge=function(e){return this._processEdge(e,"insert")};o.prototype._processEdge=function(t,r){this.logger("debug","Edge",r,t);if(typeof t!=="object"||!r||!t.from)return;if(r==="insert"&&!t.to)return;if(r==="delete"&&!t.id)return;var s=e.getTiddler($tw.tmap.indeces.tById[t.from]);if(!s)return;if(!t.id)t.id=e.genUUID();var o=new i(t.type);var a=e.parseFieldData(s.fields.title,this.opt.field.edges,{});if(r==="insert"){a[t.id]={to:t.to,type:o.getId()};if(!o.exists()){o.persist()}}else if(r==="delete"){delete a[t.id]}e.writeFieldData(s.fields.title,this.opt.field.edges,a);return t};o.prototype.getAdjacencyList=function(t,i){$tw.tmap.start("Creating adjacency list");if(!i)i={};if(!i.edges){var r=e.getMatches(this.opt.selector.allPotentialNodes);i.edges=this.getAllOutgoingEdges(r,i)}var s=e.groupByProperty(i.edges,t);$tw.tmap.stop("Creating adjacency list");return s};o.prototype.getNeighbours=function(t,i){$tw.tmap.start("Get neighbours");i=i||{};t=t.slice();var r=i.addProperties;var s=this.getAdjacencyList("to",i);var o=e.getDataMap();var a=e.getDataMap();var d=parseInt(i.steps)>0?i.steps:1;var n=function(){var d=e.getArrayValuesAsHashmapKeys(t);for(var n=t.length-1;n>=0;n--){if(e.isSystemOrDraft(t[n]))continue;var l=this.getEdges(t[n],i);for(var p in l){var g=$tw.tmap.indeces.tById[l[p].to];if(d[g])continue;if(!a[l[p].to]){var f=this.makeNode(g,r,i.view);if(f){a[l[p].to]=f;t.push(g)}}}$tw.utils.extend(o,l);var h=s[$tw.tmap.indeces.idByT[t[n]]];if(h){for(var u=0;u<h.length;u++){var v=$tw.tmap.indeces.tById[h[u].from];if(d[v])continue;if(!a[h[u].from]){var f=this.makeNode(v,r,i.view);if(f){a[h[u].from]=f;t.push(v)}}o[h[u].id]=h[u]}}}}.bind(this);for(var l=0;l<d;l++){var p=t.length;n();if(p===t.length)break}if(i.view){this._restorePositions(a,i.view)}var g={nodes:a,edges:o};this.logger("debug","Retrieved neighbourhood",g,"steps",l);$tw.tmap.stop("Get neighbours");return g};o.prototype.getGraph=function(i){$tw.tmap.start("Assembling Graph");i=i||{};var r=new t(i.view);var s=e.getMatches(i.filter||r.getNodeFilter("compiled"));var o=i.neighbourhoodScope||r.getConfig("neighbourhood_scope");var a={};a.nodes=this.selectNodesByReferences(s,{view:r,outputType:"hashmap",addProperties:{group:"matches"}});a.edges=this.getAllOutgoingEdges(s,{toFilter:e.getArrayValuesAsHashmapKeys(s),toFilterStyle:"whitelist",typeFilter:r.getTypeWhiteList(),typeFilterStyle:"whitelist"});if(parseInt(o)){var d=this.getNeighbours(s,{steps:parseInt(o),view:r,typeFilter:r.getTypeWhiteList(),typeFilterStyle:"whitelist",addProperties:{group:"neighbours"}});$tw.utils.extend(a.edges,d.edges);$tw.utils.extend(a.nodes,d.nodes)}$tw.tmap.stop("Assembling Graph");this.logger("debug","Assembled graph:",a);return a};o.prototype.getEdges=function(t,r){if(!e.tiddlerExists(t)||e.isSystemOrDraft(t)){return}if(!r)r={};var s=r.toFilter||e.getDataMap();var o=r.toFilterStyle==="whitelist";var a=r.typeFilter||e.getDataMap();var d=r.typeFilterStyle==="whitelist";var n=e.getTiddlerRef(t);var l=e.getTiddler(n);var p=e.getDataMap();var g=e.parseFieldData(l,this.opt.field.edges,{});for(var f in g){var h=g[f];var u=$tw.tmap.indeces.tById[h.to];if(!u)continue;if(o?s[u]:!s[u]){if(d?a[h.type]:!a[h.type]){var v=this.makeEdge(this.getId(n),h.to,h.type,f);if(v){p[f]=v}}}}var y=function(t){for(var r in t){var l=d?a[r]:!a[r];if(!l)continue;var g=t[r];r=new i(r);for(var f=0;f<g.length;f++){var h=g[f];if(!$tw.wiki.tiddlerExists(h))continue;if(e.isSystemOrDraft(h))continue;if(o?s[h]:!s[h]){var u=r.getId()+$tw.utils.hashString(n+h);var v=this.makeEdge(this.getId(n),this.getId(h),r,u);if(v){p[v.id]=v}}}}}.bind(this);y({"tmap:tag":l.fields.tags||[],"tmap:link":this.wiki.getTiddlerLinks(n)});return p};o.prototype.getAllOutgoingEdges=function(t,i){var r=e.getDataMap();for(var s=0;s<t.length;s++){$tw.utils.extend(r,this.getEdges(t[s],i))}return r};o.prototype.selectEdgesByType=function(t){var r=e.getDataMap();r[new i(t).getId()]=true;var s=e.getMatches(this.opt.selector.allPotentialNodes);var o=this.getAllOutgoingEdges(s,{typeFilter:r,typeFilterStyle:"whitelist"});return o};o.prototype._processEdgesWithType=function(e,t){e=new i(e);this.logger("debug","Processing edges",e,t);var r=this.selectEdgesByType(e);if(t.action==="rename"){var s=new i(t.newName);s.loadDataFromType(e);s.persist()}for(var o in r){this._processEdge(r[o],"delete");if(t.action==="rename"){r[o].type=t.newName;this._processEdge(r[o],"insert")}}$tw.wiki.deleteTiddler(e.getPath())};o.prototype.selectNodesByFilter=function(t,i){var r=e.getMatches(t);return this.selectNodesByReferences(r,i)};o.prototype.selectNodesByReferences=function(t,i){i=i||{};var r=i.addProperties;var s=e.getDataMap();var o=Object.keys(t);for(var a=0;a<o.length;a++){var d=this.makeNode(t[o[a]],r,i.view);if(d){s[d.id]=d}}if(i.view){this._restorePositions(s,i.view)}return e.convert(s,i.outputType)};o.prototype.makeEdge=function(t,r,s,o){if(!t||!r)return;if(t instanceof $tw.Tiddler){t=t.fields[this.opt.field.nodeId]}else if(typeof t==="object"){t=t.id}s=new i(s);var a={id:o?o:e.genUUID(),from:t,to:r,type:s.getId()};a.label=e.isTrue(s.getData("show-label"),true)?s.getLabel():null;a=$tw.utils.extend(a,s.getData("style"));return a};o.prototype.makeNode=function(i,r,o){var a=e.getTiddler(i,true);if(!a||a.isDraft()||this.wiki.isSystemTiddler(a.fields.title)){return}var d={shape:"box"};var o=new t(o);if(o.exists()){if(o.isEnabled("physics_mode")){d.allowedToMoveX=true;d.allowedToMoveY=true}}var n=a.fields[this.opt.field.nodeIcon];if(n){var l=e.getTiddler(n);if(l&&l.fields.text){var p=l.fields.type?l.fields.type:"image/svg+xml";var g=l.fields.text;d.shape="image";if(p==="image/svg+xml"){g=g.replace(/\r?\n|\r/g," ");if(!e.inArray("xmlns",g)){g=g.replace(/<svg/,'<svg xmlns="http://www.w3.org/2000/svg"')}}var f=$tw.config.contentTypeInfo[p].encoding==="base64"?g:window.btoa(g);d.image="data:"+p+";base64,"+f}}var h=a.fields[this.opt.field.nodeLabel];d.label=h&&this.opt.field.nodeLabel!=="title"?this.wiki.renderText("text/plain","text/vnd-tiddlywiki",h):a.fields.title;if(a.fields.color){d.color=a.fields.color;d.fontColor=s(d.color,"#FFFFFF","#000000","#FFFFFF")}if(typeof r==="object"){d=$tw.utils.extend(d,r)}d.id=this.assignId(a);return d};o.prototype.selectNodesByIds=function(e,t){var i=this.getTiddlersById(e);return this.selectNodesByReferences(i,t)};o.prototype.selectNodeById=function(t,i){i=e.merge(i,{outputType:"hashmap"});var r=this.selectNodesByIds([t],i);return r[t]};o.prototype.getTiddlersById=function(t){if(Array.isArray(t)){t=e.getArrayValuesAsHashmapKeys(t)}else if(t instanceof r.DataSet){t=e.getLookupTable(t,"id")}var i=[];for(var s in t){var o=$tw.tmap.indeces.tById[s];if(o)i.push(o)}return i};o.prototype.getId=function(t){return $tw.tmap.indeces.idByT[e.getTiddlerRef(t)]};o.prototype.deleteNode=function(t){if(!t)return;var i=typeof t==="object"?t.id:t;var r=$tw.tmap.indeces.tById[i];if(!e.tiddlerExists(r))return;var s=this.opt.field.nodeId;var o=this.wiki.getTiddlerList("$:/StoryList");var a=o.indexOf(r);if(a!==-1){o.splice(a,1);var d=this.wiki.getTiddler("$:/StoryList");e.setField(d,"list",o)}var n=this.getNeighbours([r]);this.deleteEdges(n.edges);this.wiki.deleteTiddler(r)};o.prototype.getView=function(e,i){return new t(e,i)};o.prototype.createView=function(e){if(typeof e!=="string"||e===""){e="My view"}var i=this.wiki.generateNewTitle(this.opt.path.views+"/"+e);return new t(i,true)};o.prototype._restorePositions=function(i,r){r=new t(r);if(!r.exists())return;var s=r.getPositions();for(var o in i){if(e.hasOwnProp(s,o)){i[o].x=s[o].x;i[o].y=s[o].y}}};o.prototype.storePositions=function(e,i){i=new t(i);i.setPositions(e)};o.prototype.assignId=function(t,i){var r=e.getTiddler(t,true);if(!r)return;var s=this.opt.field.nodeId;var o=r.fields[s];if(!o||i&&s!=="title"){o=e.genUUID();e.setField(r,s,o);this.logger("info","Assigning new id to",r.fields.title)}$tw.tmap.indeces.tById[o]=r.fields.title;$tw.tmap.indeces.idByT[r.fields.title]=o;return o};o.prototype.insertNode=function(i,r){if(!r||typeof r!=="object")r={};if(typeof i!=="object"){i=e.getDataMap()}var s=e.getDataMap();s.title=this.wiki.generateNewTitle(i.label?i.label:"New node");i.label=s.title;if(this.opt.field.nodeId==="title"){i.id=s.title}else{i.id=e.genUUID();s[this.opt.field.nodeId]=i.id}if(r.view){var o=new t(r.view);o.addNodeToView(i)}this.wiki.addTiddler(new $tw.Tiddler(s,this.wiki.getModificationFields(),this.wiki.getCreationFields()));return i};exports.Adapter=o})();