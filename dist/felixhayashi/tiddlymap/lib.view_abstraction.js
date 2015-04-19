/*\

title: $:/plugins/felixhayashi/tiddlymap/view_abstraction.js
type: application/javascript
module-type: library

@module TiddlyMap
@preserve

\*/
(function(){var t=require("$:/plugins/felixhayashi/tiddlymap/edgetype.js").EdgeType;var i=function(t,e){this.createShortcuts();if(t instanceof i){return t}this.path=this.utils.getDataMap();this.path.config=this._getConfigPath(t);if(e){this._createView()}else if(!this.exists()){return}this.path.map=this.path.config+"/map";this.path.nodeFilter=this.path.config+"/filter/nodes";this.path.edgeFilter=this.path.config+"/filter/edges";this._ignoreOnNextRebuild=this.utils.getDataMap();this.rebuildCache(this.utils.getValues(this.path))};i.prototype.createShortcuts=function(){this.wiki=$tw.wiki;this.opt=$tw.tmap.opt;this.logger=$tw.tmap.logger;this.utils=$tw.tmap.utils};i.prototype._getConfigPath=function(t){if(t instanceof $tw.Tiddler){return t.fields.title}if(typeof t=="string"){t=this.utils.getWithoutPrefix(t,this.opt.path.views+"/");if(!this.utils.hasSubString(t,"/")){return this.opt.path.views+"/"+t}}};i.prototype.getPaths=function(){return this.path};i.prototype._createView=function(){if(this.exists()){this.destroy()}var t={};t.title=this.path.config;t[this.opt.field.viewMarker]=true;t.id=this.utils.genUUID();this.wiki.addTiddler(new $tw.Tiddler(t))};i.prototype.isLocked=function(){return this.wiki.isShadowTiddler(this.path.config)};i.prototype.refresh=function(t){return this.rebuildCache(Object.keys(t))};i.prototype.rebuildCache=function(t,i){if(!this.exists())return[];if(this.utils.inArray(this.path.config,t)){this.logger("debug","Reloading config of view",this.getLabel(),"; trigger full rebuild");t=this.utils.getValues(this.path)}var e=this._ignoreOnNextRebuild;this._ignoreOnNextRebuild=this.utils.getDataMap();var s=[];for(var r=0;r<t.length;r++){var o=t[r];if(!i&&e[o]){continue}else if(o===this.path.config){this.config=this.getConfig(null,true)}else if(o===this.path.map){this.positions=this.getPositions(true)}else if(o===this.path.nodeFilter){this.nodeFilter=this.getNodeFilter(null,true)}else if(o===this.path.edgeFilter){this.edgeFilter=this.getEdgeFilter(null,true);this.typeWhiteList=this.getTypeWhiteList(true)}else if(this.utils.startsWith(o,this.opt.path.edgeTypes)){this.typeWhiteList=this.getTypeWhiteList(true)}else{continue}s.push(o)}return s};i.prototype.exists=function(){return this.utils.tiddlerExists(this.path.config)};i.prototype.getRoot=function(){return this.path.config};i.prototype.getCreationDate=function(){if(this.exists()){return this.wiki.getTiddler(this.path.config).fields["created"]}};i.prototype.getLabel=function(){if(!this.exists())return;return this.utils.getBasename(this.path.config)};i.prototype.destroy=function(){if(!this.exists())return;var t="[prefix["+this.getRoot()+"]]";this.utils.deleteTiddlers(this.utils.getMatches(t));this.path=this.utils.getDataMap()};i.prototype.getReferences=function(){var t="[regexp:text[<\\$tiddlymap.*?view=."+this.getLabel()+"..*?>]]";return this.utils.getMatches(t)};i.prototype.rename=function(t){if(!this.exists()||typeof t!=="string"){return}if(this.utils.inArray("/",t)){$tw.tmap.notify('A view name must not contain any "/"');return}var i=this.getLabel();if(i===t){return}for(index in this.path){var e=this.wiki.getTiddler(this.path[index]);if(!e)continue;this.path[index]=this.path[index].replace(i,t);this.wiki.addTiddler(new $tw.Tiddler(e,{title:this.path[index]}));this.wiki.deleteTiddler(e.fields.title)}this.rebuildCache(this.utils.getValues(this.path),true)};i.prototype.isEnabled=function(t){return this.utils.isTrue(this.getConfig(t),false)};i.prototype.getConfig=function(t,i,e){if(!this.exists()){var s=this.utils.getDataMap()}else if(!i&&this.config){var s=this.config}else{var r=this.wiki.getTiddler(this.path.config).fields;var s=this.utils.getPropertiesByPrefix(r,"config.");defaults={"config.layout.active":"user"};$tw.utils.extend(defaults,s)}return t?s[this.utils.startsWith(t,"config.")?t:"config."+t]:s};i.prototype.getStabilizationIterations=function(){return this.stabIterations?this.stabIterations:1e3};i.prototype.setStabilizationIterations=function(t){};i.prototype.getHierarchyEdgeTypes=function(){if(this.getConfig("layout.active")!=="hierarchical")return[];var t=this.utils.getPropertiesByPrefix(this.getConfig(),"config.layout.hierarchical.order-by-",true);var i=this.utils.getDataMap();for(var e in t){if(t[e]==="true"){var s=this.utils.getTiddler($tw.tmap.indeces.tById[e]);if(s){i[this.utils.getBasename(s.fields.title)]=true}}}return i};i.prototype.setConfig=function(){this.logger("log","Updating config",this.config,"with",arguments);if(arguments[0]==null)return;if(arguments.length===1&&typeof arguments[0]==="object"){for(var t in arguments[0]){this.setConfig(t,arguments[0][t])}}else if(arguments.length===2&&typeof arguments[0]==="string"){var t=this.utils.getWithoutPrefix(arguments[0],"config.");var i=arguments[1];if(i){if(t==="edge_type_namespace"){i=i.replace(/([^:])$/,"$1:")}this.config["config."+t]=i}}else{return}this.wiki.addTiddler(new $tw.Tiddler(this.wiki.getTiddler(this.path.config),this.config));this._ignoreOnNextRebuild[this.path.config]=true};i.prototype.isExplicitNode=function(t){return this.getNodeFilter("expression").match(this.utils.escapeRegex(this._getAddNodeFilterPart(t)))};i.prototype.isLiveView=function(t){return this.getLabel()===this.opt.misc.liveViewLabel};i.prototype.removeNodeFromFilter=function(t){if(!this.isExplicitNode(t))return false;var i=this.getNodeFilter("expression");var e=i.replace(this._getAddNodeFilterPart(t),"");this.setNodeFilter(e);return true};i.prototype._getAddNodeFilterPart=function(t){return"[field:"+this.opt.field.nodeId+"["+t.id+"]]"};i.prototype.setNodeFilter=function(t){if(!this.exists())return;if(this.isLiveView()){$tw.tmap.notify("It is forbidden to change the node filter of the live view!");return}t=t.replace("\n"," ");if(this.getNodeFilter.expression===t){return}this.utils.setField(this.path.nodeFilter,"filter",t);this.logger("debug","Node filter set to",t);this.nodeFilter=this.getNodeFilter(null,true);this._ignoreOnNextRebuild[this.path.nodeFilter]=true};i.prototype.setEdgeFilter=function(t){if(!this.exists())return;t=t.replace("\n"," ");if(this.getEdgeFilter.expression===t){return}this.utils.setField(this.path.edgeFilter,"filter",t);this.logger("debug","Edge filter set to",t,this.path.edgeFilter);this.edgeFilter=this.getEdgeFilter(null,true);this._ignoreOnNextRebuild[this.path.edgeFilter]=true};i.prototype.appendToNodeFilter=function(t){var t=this.getNodeFilter("expression")+" "+t;this.setNodeFilter(t)};i.prototype.addNodeToView=function(t){this.appendToNodeFilter(this._getAddNodeFilterPart(t));this.setNodePosition(t)};i.prototype.getEdgeFilter=function(t,i){if(!i&&this.edgeFilter){var e=this.edgeFilter}else{var e=this.utils.getDataMap();var s=this.wiki.getTiddler(this.path.edgeFilter);e.expression=s&&s.fields.filter?s.fields.filter:this.opt.filter.defaultEdgeFilter;e.compiled=this.wiki.compileFilter(e.expression)}return t?e[t]:e};i.prototype.getTypeWhiteList=function(i){if(!i&&this.typeWhiteList){return this.typeWhiteList}else{var e=this.utils.getDataMap();var s=this.utils.getMatches(this.opt.selector.allEdgeTypes);var r=this.utils.getMatches(this.getEdgeFilter("compiled"),s);for(var o=0;o<r.length;o++){var n=this.utils.getWithoutPrefix(r[o],this.opt.path.edgeTypes+"/");e[n]=new t(n)}return e}};i.prototype.getNodeFilter=function(t,i){if(!i&&this.nodeFilter){var e=this.nodeFilter}else{var e=this.utils.getDataMap();var s=this.wiki.getTiddler(this.path.nodeFilter);e.expression=s&&s.fields.filter?s.fields.filter:"";e.compiled=this.wiki.compileFilter(e.expression)}return t?e[t]:e};i.prototype.getPositions=function(t){if(!this.isLiveView()&&!t&&this.positions){return this.positions}var i=this.utils.parseFieldData(this.getPositionStore(),"text",{});this.logger("debug","Loading positions",i,"from",this.getPositionStore());return i};i.prototype.setPositions=function(t){if(!this.exists()||typeof t!=="object")return;$tw.tmap.logger("log","Storing positions in",this.getPositionStore());this.utils.writeFieldData(this.getPositionStore(),"text",t);this.positions=t;this._ignoreOnNextRebuild[this.path.map]=true};i.prototype.getPositionStore=function(){if(this.isLiveView()){var t=this.utils.getMatches(this.getNodeFilter("compiled"))[0];if(t){return this.path.map+"/"+$tw.tmap.indeces.idByT[t]}}return this.path.map};i.prototype.setNodePosition=function(t){if(t&&t.x&&t.y){var i=this.getPositions();i[t.id]={x:t.x,y:t.y};this.setPositions(i)}};exports.ViewAbstraction=i})();