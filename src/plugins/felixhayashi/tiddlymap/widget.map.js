/*\

title: $:/plugins/felixhayashi/tiddlymap/widget/map.js
type: application/javascript
module-type: widget

@module TiddlyMap
@preserve

\*/

(/** @lends module:TiddlyMap*/function(){

  /*jslint node: true, browser: true */
  /*global $tw: false */
  
  "use strict";
  
  /**************************** IMPORTS ****************************/
   
  var Widget = require("$:/core/modules/widgets/widget.js").widget;
  var ViewAbstraction = require("$:/plugins/felixhayashi/tiddlymap/view_abstraction.js").ViewAbstraction;
  var CallbackManager = require("$:/plugins/felixhayashi/tiddlymap/callback_manager.js").CallbackManager;
  var DialogManager = require("$:/plugins/felixhayashi/tiddlymap/dialog_manager.js").DialogManager;
  var utils = require("$:/plugins/felixhayashi/tiddlymap/utils.js").utils;
  var EdgeType = require("$:/plugins/felixhayashi/tiddlymap/edgetype.js").EdgeType;
  var vis = require("$:/plugins/felixhayashi/vis/vis.js");

  /***************************** CODE ******************************/
        
  /**
   * @constructor
   */
  var MapWidget = function(parseTreeNode, options) {
    
    // call the constructor
    Widget.call(this);
    
    // Main initialisation inherited from widget.js
    this.initialise(parseTreeNode, options);
    
    // create shortcuts and aliases
    this.adapter = $tw.tmap.adapter;
    this.opt = $tw.tmap.opt;
    this.notify = $tw.tmap.notify;
    
    // instanciate managers
    this.callbackManager = new CallbackManager();
    this.dialogManager = new DialogManager(this.callbackManager, this);
        
    // https://github.com/Jermolene/TiddlyWiki5/blob/master/core/modules/widgets/widget.js#L211
    this.computeAttributes();
    
    // who am I?
    this.objectId = (this.getAttribute("object-id")
                     ? this.getAttribute("object-id")
                     : utils.genUUID());
                         
    // register whether in editor mode or not
    this.editorMode = this.getAttribute("editor");
        
    if(this.editorMode) {
      
      utils.addListeners({
        "tmap:tm-create-view": this.handleCreateView,
        "tmap:tm-rename-view": this.handleRenameView,
        "tmap:tm-delete-view": this.handleDeleteView,
        "tmap:tm-edit-view": this.handleEditView,
        "tmap:tm-configure-system": this.handleConfigureSystem,
        "tmap:tm-store-position": this.handleStorePositions,
        "tmap:tm-edit-filters": this.handleEditFilters,
        "tmap:tm-generate-widget": this.handleGenerateWidget
      }, this, this);
      
    }
    
    utils.addListeners({
      "tmap:tm-focus-node": this.handleFocusNode,
      "tmap:tm-reset-focus": this.repaintGraph
    }, this, this);
    
  };
  
  // !! EXTENSION !!
  MapWidget.prototype = Object.create(Widget.prototype);
  // !! EXTENSION !!
    
  /**
   * This handler will open a dialog in which the user specifies an
   * edgetype to use to create an edge between to nodes.
   * 
   * Before any result is displayed to the user on the graph, the
   * relationship needs to be persisted in the store for the according
   * edgetype. If that operation was successful, each graph will instantly
   * be aware of the change as it listens to tiddler changes.
   * 
   * @param {Edge} edge - A javascript object that contains at least
   *    the properties "from", "to" and "label"
   * @param {function} [callback] - A function with the signature
   *    function(isConfirmed);
   */
  MapWidget.prototype.handleConnectionEvent = function(edge, callback) {

    var vars = {
      fromLabel: this.adapter.selectNodeById(edge.from).label,
      toLabel: this.adapter.selectNodeById(edge.to).label
    };
    
    this.dialogManager.open("getEdgeType", vars, function(isConfirmed, outputTObj) {
    
      if(isConfirmed) {
        
        var type = utils.getText(outputTObj);
        
        // check whether type string comes with a namespace
        var hasNamespace = utils.hasSubString(type, ":");
        
        // get the default name space of the view
        var ns = this.view.getConfig("edge_type_namespace");
        
        edge.type = (ns && !hasNamespace ? ns : "") + type;
        var isSuccess = this.adapter.insertEdge(edge);
        
      }
      
      if(typeof callback == "function") {
        callback(isConfirmed);
      }
        
    });
    
  };
  
  MapWidget.prototype.checkForFreshInstall = function() {

    if(utils.getEntry(this.opt.ref.sysMeta, "showWelcomeMessage", true)) {
      utils.setEntry(this.opt.ref.sysMeta, "showWelcomeMessage", false);
      this.logger("debug", "Showing welcome message");
      this.dialogManager.open("welcome", { dialog: { buttons: "ok" }});
    }
    
  };
  
  /**
   * Promts a dialog that will confront the user with making a tough choice :)
   * @param {function} [callback] - A function with the signature function(isConfirmed).
   * @param {string} [message] - An small optional message to display.
   */
  MapWidget.prototype.openStandardConfirmDialog = function(callback, message) {
  
    var param = {
      message : message,
      dialog: {
        confirmButtonLabel: "Yes, proceed",
        cancelButtonLabel: "Cancel"
      }
    };
    
    this.dialogManager.open("getConfirmation", param, callback);
  };
    
  MapWidget.prototype.logger = function(type, message /*, more stuff*/) {
    
    var args = Array.prototype.slice.call(arguments, 1);
    args.unshift("@" + this.objectId.toUpperCase());
    args.unshift(type);
    $tw.tmap.logger.apply(this, args);
    
  };
  
  /**
   * Method to render this widget into the DOM.
   * Attention: BE CAREFUL WITH THE ORDER OF FUNCTION CALLS IN THIS FUNCTION.
   * 
   * @override
   */
  MapWidget.prototype.render = function(parent, nextSibling) {
    
    // remember our place in the dom
    this.parentDomNode = parent;
    
    // add widget classes
    this.registerClassNames(parent);
    
    this.sidebar = document.getElementsByClassName("tc-sidebar-scrollable")[0];
    this.isContainedInSidebar = (this.sidebar && this.sidebar.contains(this.parentDomNode));
        
    // get view and view holder
    this.viewHolderRef = this.getViewHolderRef();
    this.view = this.getView();
                    
    // *first* inject the bar
    this.initAndRenderEditorBar(parent);
    
    // *second* initialise graph variables and render the graph
    this.initAndRenderGraph(parent);
    
    // register this graph at the caretaker's graph registry
    $tw.tmap.registry.push(this);
    
    // if any refresh-triggers exist, register them
    this.checkOnRefreshTriggers();
    
    this.checkForFreshInstall();

  };
  
  /**
   * Add some classes to give the user a chance to apply some css
   * to different graph modes.
   */
  MapWidget.prototype.registerClassNames = function(parent) {
    
    if(!$tw.utils.hasClass(parent, "tmap-widget")) {
      
      var classes = [ "tmap-widget" ];
      if(utils.isTrue(this.getAttribute("click-to-use"), true)) {
        classes.push("tmap-click-to-use");
      }
      if(this.getAttribute("editor") === "advanced") {
        classes.push("tmap-advanced-editor");
      }
      if(!utils.isTrue(this.getAttribute("show-buttons"), true)) {
        classes.push("tmap-no-buttons");
      }
      if(this.getAttribute("class")) {
        classes.push(this.getAttribute("class"));
      }
      
      $tw.utils.addClass(parent, classes.join(" "));
    }
    
  };
  
  /**
   * The editor bar contains a bunch of widgets that allow the user
   * to manipulate the current view.
   * 
   * Attention: The Editor bar needs to render *after* the graph
   * because some elements depend on the graph's nodes which are
   * calculated when the network is created.
   * 
   * @param {Element} parent The dom node in which the editor bar will
   *     be injected in.
   */
  MapWidget.prototype.initAndRenderEditorBar = function(parent) {
        
      this.graphBarDomNode = document.createElement("div");
      $tw.utils.addClass(this.graphBarDomNode, "tmap-topbar");
      parent.appendChild(this.graphBarDomNode);
      
      this.rebuildEditorBar();
      this.renderChildren(this.graphBarDomNode);
    
  };

  /**
   * Creates this widget's child-widgets.
   * 
   * @see https://groups.google.com/forum/#!topic/tiddlywikidev/sJrblP4A0o4
   * @see blob/master/editions/test/tiddlers/tests/test-wikitext-parser.js
   */
  MapWidget.prototype.rebuildEditorBar = function() {
        
    // register variables
    
    var variables = utils.flatten({
      param: {
        viewLabel: this.view.getLabel(),
        isViewBound: String(this.isViewBound()),
        ref: {
          view: this.view.getRoot(),
          viewHolder: this.getViewHolderRef(),
          edgeFilter: this.view.getPaths().edgeFilter
        },
        allEdgesFilter: this.opt.selector.allEdgeTypes,
        searchOutput: "$:/temp/tmap/bar/search",
        nodeFilter: "[list[$:/temp/tmap/nodes/" + this.view.getLabel() + "]"
                    + "search:title{$:/temp/tmap/bar/search}]"
      }
    });
    
    for(var name in variables) {
      this.setVariable(name, variables[name]);
    }
    
    // Construct the child widget tree
    var body = {
      type: "tiddler",
      attributes: {
        tiddler: { type: "string", value: this.view.getRoot() }
      },
      children: []
    };
    
    if(this.editorMode === "advanced") {
      
      body.children.push({
        type: "transclude",
        attributes: {
          tiddler: { type: "string", value: this.opt.ref.graphBar }
        }
      });
      
    } else {
      
      body.children.push({
        type: "element",
        tag: "span",
        attributes: { class: { type: "string", value: "tmap-view-label" }},
        children: [ {type: "text", text: variables["param.viewLabel"] } ]
      });
      
    }
    
    body.children.push({
      type: "transclude",
      attributes: {
        tiddler: { type: "string", value: this.opt.ref.focusButton }
      }
    });

        
    this.makeChildWidgets([body]);

  };
      
  /**
   * This function is called by the system to notify the widget about
   * tiddler changes.
   * 
   * The changes are analyzed by several functions.
   * 
   * 1. checking for callbacks: some processes decided at runtime to 
   * listen to changes of single tiddlers (for example dialogs waiting
   * for results). So at first it is checked if a callback is triggered.
   * 
   * 2. checking for view changes: a view may be replaced (switched)
   * or modified. This will result in recalculation of the graph.
   * 
   * 3. checking for graph refresh: does the graph need an update
   * because nodes/edges have been modified, added or removed or the
   * view has changed?
   * 
   * 4. checking for graphbar refresh: Did some widgets need a rerendering
   * due to changes that affect the topbar (view switched or modified)?
   * 
   * @override
   * @see https://groups.google.com/d/msg/tiddlywikidev/hwtX59tKsIk/EWSG9glqCnsJ
   */
  MapWidget.prototype.refresh = function(changedTiddlers) {
        
    // in any case, check for callbacks triggered by tiddlers
    this.callbackManager.handleChanges(changedTiddlers);
    
    var isViewSwitched = this.isViewSwitched(changedTiddlers);
    var viewModifications = this.view.refresh(changedTiddlers);
            
    if(isViewSwitched || viewModifications.length) {

      var options = {
        resetData: true,
        resetOptions: true,
        resetFocus: true
      };

      if(isViewSwitched) {
        this.logger("warn", "View switched");
        this.view = this.getView(true);
      } else {
        this.logger("warn", "View modified", viewModifications);
        options.resetData = false;
      }
      
      this.rebuildGraph(options);
      
      // maybe refresh-triggers changed
      this.checkOnRefreshTriggers();
                        
    } else {
      
      // check for changes that effect the graph on an element level
      this.checkOnGraph(changedTiddlers);
            
    }
    
    // in any case give child widgets a chance to refresh
    this.checkOnEditorBar(changedTiddlers, isViewSwitched, viewModifications);

  };
  
  /**
   * Refresh-triggers are tiddlers whose mere occurrence in the
   * changedTiddlers list forces tiddlymap to reassert
   * whether a filter expression returns the same set of matches as it
   * is currently displayed in the graph.
   * 
   * The raison d'etre for refresh-triggers is that a filter may contain
   * implicit text-references or variables that may require a filter to be
   * reasserted even though, the filter expression itself did not change.
   * 
   * For example a filter `[field:title{$:/HistoryList!!current-tiddler}]`
   * requires a `$:/HistoryList` refresh trigger to be added to the view so
   * everytime the `$:/HistoryList` tiddler changes, the filter gets
   * reasserted.
   */
  MapWidget.prototype.checkOnRefreshTriggers = function() { 
    
    // remove old triggers (if there are any)
    this.callbackManager.remove(this.refreshTriggers);
        
    // load new trigger list either from attribute or view config
    var str = this.getAttribute("refresh-triggers") || this.view.getConfig("refresh-triggers");
    this.refreshTriggers = $tw.utils.parseStringArray(str) || [];
    
    this.logger("debug", "Registering refresh trigger", this.refreshTriggers);
    
    // TODO: not nice, if more than one trigger changed it will cause multiple reassertments
    for(var i = 0; i < this.refreshTriggers.length; i++) {
      this.callbackManager.add(this.refreshTriggers[i],
                               this.handleTriggeredRefresh.bind(this),
                               false);
    }
    
  };
  
  MapWidget.prototype.rebuildGraph = function(options) {
    
    this.logger("debug", "Rebuilding graph");
    
    if(!options) options = {};
    
    // always reset to allow handling of stabilized-event!
    this.hasNetworkStabilized = false;
    
    if(options.resetData) {
      this.graphData.edges.clear();
      this.graphData.nodes.clear();
      this.graphData.edgesById = null;
      this.graphData.nodesById = null;
    }
        
    if(options.resetOptions) {
      this.graphOptions = this.getGraphOptions();
      this.network.setOptions(this.graphOptions);
    }
    
    this.rebuildGraphData(true);

    if(options.resetFocus && !this.preventNextContextReset) {
      if(typeof options.resetFocus !== "object") {
        options.resetFocus = {
          delay: 0,
          duration: 0
        };
      }
      this.fitGraph(options.resetFocus.delay,
                    options.resetFocus.duration);
      this.doZoomAfterStabilize = true;              
      this.preventNextContextReset = false;
    }

  };
  
  /**
   * Warning: Do not change this functionname as it is used by the
   * caretaker's routinely checkups.
   */
  MapWidget.prototype.getContainer = function() {
    return this.parentDomNode;
  }
  
  /**
   * param {boolean} isRebuild
   * param {NodeCollection} [nodes] - An optional set of nodes to use
   *     instead of the set created according to the nodes filter. Supplying
   *     a nodes collection will always recreate the cache despite the value
   *     of `isRebuild`.
   */
  MapWidget.prototype.rebuildGraphData = function(isRebuild) {
    
    $tw.tmap.start("Reloading Network");
    
    if(!isRebuild && this.graphData) {
      return this.graphData;
    }

    var graph = this.adapter.getGraph({ view: this.view });    
    var nodes = graph.nodes;
    var edges = graph.edges;
        
    this.graphData.nodes = this.getRefreshedDataSet(nodes, // new nodes
                                         this.graphData.nodesById, // old nodes
                                         this.graphData.nodes); // dataset
                                                                                  
    this.graphData.edges = this.getRefreshedDataSet(edges, // new edges
                                         this.graphData.edgesById, // old edges
                                         this.graphData.edges); // dataset
                                       
    // create lookup tables
    
    this.graphData.nodesById = nodes;
    this.graphData.edgesById = edges;
    
    utils.setField("$:/temp/tmap/nodes/" + this.view.getLabel(), "list", this.adapter.getTiddlersById(nodes));
    
    $tw.tmap.stop("Reloading Network");
    
    return this.graphData;
        
  };

  MapWidget.prototype.isViewBound = function() {
    
    return utils.startsWith(this.getViewHolderRef(), this.opt.path.localHolders);  
    
  };
    
  MapWidget.prototype.isViewSwitched = function(changedTiddlers) {
  
    if(this.isViewBound()) {
      return false; // bound views can never be switched!
    } else {
      return utils.hasOwnProp(changedTiddlers, this.getViewHolderRef());
    }
    
  };
  
  /**
   * This method will ckeck if any tw-widget needs a refresh.
   */
  MapWidget.prototype.checkOnEditorBar = function(changedTiddlers, isViewSwitched, viewModifications) {
    
    // @TODO viewModifications is actually really heavy. I could narrow this.
    if(isViewSwitched || viewModifications.length) {
      
      // full rebuild
      //this.logger("info", "The graphbar needs a full refresh");
      this.removeChildDomNodes();
      // update all variables and build the tree
      this.rebuildEditorBar();
      this.renderChildren(this.graphBarDomNode);
      return true;
      
    } else {
      
      // let children decide for themselves
      //this.logger("info", "Propagate refresh to childwidgets");
      return this.refreshChildren(changedTiddlers);
      
    }
    
  };
  
  /**
   * Rebuild or update the graph if one of the following events occured:
   * 
   * 1. A node that matches the node filter has been added or modified.
   * 2. A node that once matched the node filter has been removed
   * 3. An edge that matches the edge filter has been added or removed.
   * 
   */
  MapWidget.prototype.checkOnGraph = function(changedTiddlers) {
            
    var nodeFilter = this.view.getNodeFilter("compiled");
    var matches = utils.getMatches(nodeFilter, Object.keys(changedTiddlers), true);
                                  
    for(var tRef in changedTiddlers) {
      
      if(utils.isSystemOrDraft(tRef)) continue;
      
      var isMatch = matches[tRef];
      var isDisplayed = this.graphData.nodesById[this.adapter.getId(tRef)];
            
      if(isMatch || isDisplayed) {
        // either (1) a match changed or (2) a former match is not included anymore
        this.rebuildGraph();
        return;
      }
      
    }
      
    var edgeFilter = this.view.getEdgeFilter("compiled");
    var changedEdgestores = utils.getMatches(edgeFilter, Object.keys(changedTiddlers));
    
    if(changedEdgestores.length) {
      
      this.logger("info", "Changed edge stores", changedEdgestores);
      this.rebuildGraph();
      return;
    
    }

  };
      
  /**
   * Rebuild the graph
   * 
   * @see
   *   - http://visjs.org/docs/network.html
   *   - http://visjs.org/docs/dataset.html
   */
  MapWidget.prototype.initAndRenderGraph = function(parent) {
    
    this.logger("info", "Initializing and rendering the graph");
        
    this.graphDomNode = document.createElement("div");
    parent.appendChild(this.graphDomNode);
        
    $tw.utils.addClass(this.graphDomNode, "tmap-vis-graph");

    // in contrast to the graph height, which is assigned to the vis
    // graph wrapper, the graph width is assigned to the parent
    parent.style["width"] = this.getAttribute("width", "100%");
    
    // always save reference to a bound function that is used as listener
    // see http://stackoverflow.com/a/22870717
    this.handleResizeEvent = this.handleResizeEvent.bind(this);
    this.handleClickEvent = this.handleClickEvent.bind(this);
    
    window.addEventListener("resize", this.handleResizeEvent, false);
    
    if(!this.isContainedInSidebar) {
      this.callbackManager.add("$:/state/sidebar", this.handleResizeEvent);
    }
    
    window.addEventListener("click", this.handleClickEvent, false);
    
    var fsapi = utils.getFullScreenApis();
    if(fsapi) {
      window.addEventListener(fsapi["_fullscreenChange"],
                              this.handleFullScreenChange.bind(this), false);
    }
    
    this.handleResizeEvent();

    // register options and data
    this.graphOptions = this.getGraphOptions();
    this.graphData = {
      nodes: new vis.DataSet(),
      edges: new vis.DataSet(),
      nodesById: utils.getDataMap(),
      edgesById: utils.getDataMap()
    };
    
    // init the graph with dummy data as events are not registered yet
    this.network = new vis.Network(this.graphDomNode, this.graphData, this.graphOptions);
    this.canvas = this.graphDomNode.getElementsByTagName("canvas")[0];
  
    // register events
    
    this.network.on("click", this.handleVisSingleClickEvent.bind(this));
    this.network.on("doubleClick", this.handleVisDoubleClickEvent.bind(this));
    this.network.on("stabilized", this.handleVisStabilizedEvent.bind(this));
    this.network.on('dragStart', this.handleVisDragStart.bind(this));
    this.network.on("dragEnd", this.handleVisDragEnd.bind(this));
    this.network.on("select", this.handleVisSelect.bind(this));
    this.network.on("viewChanged", this.handleVisViewportChanged.bind(this));
    
    this.addGraphButtons({
      "fullscreen-button": function() { this.handleToggleFullscreen(false); }
    });
    
    if(this.isContainedInSidebar) {
      this.addGraphButtons({
        "halfscreen-button": function() { this.handleToggleFullscreen(true); }
      });
    }
        
    // delay (100ms) the painting of the graph to allow the gui to render; freezes otherwise
    window.setTimeout(function() {
      if(!utils.hasElements(this.graphData.nodesById)) { // prevents unnecessary repainting
        this.rebuildGraph({
          resetFocus: true
        });
      }
      // fixes #97
      this.network.redraw();
    }.bind(this), 100);
  };
  
  MapWidget.prototype.getGraphOptions = function() {
    
    // current vis options can be found at $tw.tmap.logger("log", this.network.constants);
    
    if(!this.graphOptions) {
      // get a copy of the options
      var options = $tw.utils.extendDeepCopy(this.opt.config.vis);
          
      options.onDelete = function(data, callback) {
        this.handleRemoveElement(data);
        callback({});
      }.bind(this);
      options.onConnect = function(data, callback) {
        this.handleConnectionEvent(data);
      }.bind(this);
      options.onAdd = function(data, callback) {
        this.handleInsertNode(data);
      }.bind(this);
      options.onEditEdge = function(data, callback) {
        var changedData = this.handleReconnectEdge(data);
      }.bind(this);
      options.onEdit = function(node, callback) {
        this.openTiddlerWithId(node.id);
      }.bind(this);
      
      options.dataManipulation = {
        enabled : (this.editorMode ? true : false),
        initiallyVisible : true
      };
        
      options.navigation = true;
      options.clickToUse = (this.getAttribute("click-to-use") !== "false");
      
    } else {
      var options = this.graphOptions;
    }
    
    options.stabilizationIterations = this.view.getStabilizationIterations();
    
    return options;
    
  };
    
  /**
   * Create an empty view. A dialog is opened that asks the user how to
   * name the view. The view is then registered as current view.
   */
  MapWidget.prototype.handleCreateView = function() {
    
    this.dialogManager.open("createView", null, function(isConfirmed, outputTObj) {
    
      if(isConfirmed) {
        
        var label = utils.getText(outputTObj);
        var view = new ViewAbstraction(label);
        
        if(view.isLocked()) {
          this.notify("Forbidden!");
        } else {
          var view = this.adapter.createView(label);
          this.setView(view.getRoot());
        }

      }
      
    });
    
  };
  
  MapWidget.prototype.handleRenameView = function() {
       
    if(!this.view.isLocked()) {

      var references = this.view.getReferences();
      
      var fields = {
        count : references.length.toString(),
        filter : utils.joinAndWrap(references, "[[", "]]")
      };

      this.dialogManager.open("getViewName", fields, function(isConfirmed, outputTObj) {
      
        if(isConfirmed) {
          
          var label = utils.getText(outputTObj);
          var view = new ViewAbstraction(label);
          
          if(view.isLocked()) {
            this.notify("Forbidden!");
          } else {
            this.view.rename(label);
            this.setView(this.view.getRoot());
          }
          
        }

      });
      
    } else {
      this.notify("Forbidden!");
    }
    
  };
  
  MapWidget.prototype.handleEditView = function() {
        
    var params = {
      view: this.view.getLabel(),
      createdOn: this.view.getCreationDate(true),
      numberOfNodes: "" + Object.keys(this.graphData.nodesById).length,
      numberOfEdges: "" + Object.keys(this.graphData.edgesById).length,
      dialog: {
        preselects: this.view.getConfig()
      }
    };
    
    this.dialogManager.open("configureView", params, function(isConfirmed, outputTObj) {
      if(isConfirmed && outputTObj) {
        var updates = utils.getPropertiesByPrefix(outputTObj.fields, "config.");
        this.view.setConfig(updates);
      }
    });
    
  };
  
  MapWidget.prototype.handleDeleteView = function() {
    
    var viewname = this.view.getLabel();
    
    if(this.view.isLocked()) {
      this.notify("Forbidden!");
      return;
    }
    
    // regex is non-greedy

    var references = this.view.getReferences();
    if(references.length) {
            
      var fields = {
        count : references.length.toString(),
        filter : utils.joinAndWrap(references, "[[", "]]")
      };


      this.dialogManager.open("cannotDeleteViewDialog", fields, null);

      return;
      
    }

    var message = "You are about to delete the view " + 
                  "''" + viewname + "'' (no tiddler currently references this view).";
                  
    this.openStandardConfirmDialog(function(isConfirmed) { // TODO: this dialog needs an update
      
      if(isConfirmed) {
        this.view.destroy();
        this.setView(this.opt.path.views + "/default");
        this.notify("view \"" + viewname + "\" deleted ");
      }

    }, message);
    
  };
  
  /**
   * This handler will rerun the view's node-filter and assert if produced
   * matches-set is the same as the one that is currently displayed in
   * the graph. If this is not the case, a graph rebuild is initiated.
   */
  MapWidget.prototype.handleTriggeredRefresh = function(trigger) {
        
    var matches = utils.getMatches(this.view.getNodeFilter("compiled"));
    var triggerState = $tw.utils.hashString(matches.join());
    
    if(triggerState != this.triggerState) {
      
      this.logger("log", trigger, "triggered a refresh");
    
      this.triggerState = triggerState;
    
      this.rebuildGraph({
        resetData: false,
        resetOptions: false,
        resetFocus: {
          delay: 1000,
          duration: 1000
        }
      });
    }
    
  };
    
  MapWidget.prototype.handleConfigureSystem = function() {
        
    var sysConfig = utils.flatten({ config: { sys: this.opt.config.sys }});  
    var liveViewScope = this.adapter.getView("Live View").getConfig("neighbourhood_scope");
    
    var params = {
      dialog: {
        preselects: $tw.utils.extend(
                      sysConfig,
                      {  liveViewScope: liveViewScope })
      }
    };

    this.dialogManager.open("configureTiddlyMap", params, function(isConfirmed, outputTObj) {
      
      if(isConfirmed && outputTObj) {
        
        var config = utils.getPropertiesByPrefix(outputTObj.fields, "config.sys.", true);
        
        if(config["field.nodeId"] !== this.opt.field.nodeId && isWelcomeDialog !== true) {

          var params = {
            name: "Node-id",
            oldValue: this.opt.field.nodeId,
            newValue: config["field.nodeId"]
          };
          
          this.dialogManager.open("fieldChanged", params, function(isConfirmed, outputTObj) {
            if(isConfirmed) {
              utils.moveFieldValues(params.oldValue, params.newValue, true, false);
              this.notify("Transported field values");
            }
          });

        }
        
        this.wiki.setTiddlerData(this.opt.ref.sysConf + "/user", config);
        this.adapter.getView("Live View")
            .setConfig("neighbourhood_scope", outputTObj.fields.liveViewScope);
        
      }
    });
    
  };
  
  
  MapWidget.prototype.handleReconnectEdge = function(updates) {
    
    // get current edge data
    var oldEdge = this.graphData.edges.get(updates.id);
    
    // delete old edge from store
    this.adapter.deleteEdge(oldEdge);
    
    // update from and to properties
    var newEdge = $tw.utils.extend(oldEdge, updates);
        
    // insert updated edge into store
    return this.adapter.insertEdge(newEdge);
    
  };
  
  /**
   * Called by vis when the user tries to delete a node or an edge.
   * 
   * @param {Object} elements - An object containing the elements to be removed.
   * @param {Array<Id>} elements.nodes - Removed edges.
   * @param {Array<Id>} elements.edges - Removed nodes.
   */
  MapWidget.prototype.handleRemoveElement = function(elements) {
    
    if(elements.edges.length && !elements.nodes.length) { // only deleting edges
      this.handleRemoveEdges(elements.edges);
    }
                        
    if(elements.nodes.length) {
      this.handleRemoveNode(this.graphData.nodesById[elements.nodes[0]]);
    }
    
    // make the manipulation bar disapper again
    this.network.selectNodes([]);
  };
    
  MapWidget.prototype.handleRemoveEdges = function(edges) {
    
    this.adapter.deleteEdges(this.graphData.edges.get(edges));
    this.notify("edge" + (edges.length > 1 ? "s" : "") + " removed");
    
  };
  
  MapWidget.prototype.handleRemoveNode = function(node) {

    var params = {
      "var.nodeLabel": node.label,
      "var.nodeRef": $tw.tmap.indeces.tById[node.id],
      dialog: {
        preselects: {
          "opt.delete": "from" + " " + (this.view.isExplicitNode(node) ? "filter" : "system")
        }
      }
    };

    this.dialogManager.open("deleteNodeDialog", params, function(isConfirmed, outputTObj) {
      
      if(isConfirmed) {
        
        if(outputTObj.fields["opt.delete"] === "from system") {

          // will also delete edges
          this.adapter.deleteNode(node);

        } else {
        
          var success = this.view.removeNodeFromFilter(node);
          
          if(!success) {
            this.notify("Couldn't remove node from filter");
            return;
          }
          
        }
        
        this.notify("Node removed " + outputTObj.fields["opt.delete"]);
        
      }
      
    });
      
  };
  
  /**
   * Called by browser when a fullscreen change occurs (entering or
   * exiting). Its purpose is to call the toggle fullscreen function
   * once the exit fullscreen event has occured.
   */
  MapWidget.prototype.handleFullScreenChange = function() {
    
    var fsapi = utils.getFullScreenApis();
    if(fsapi && this.enlargedMode === "fullscreen" && !document[fsapi["_fullscreenElement"]]) {
      this.handleToggleFullscreen();
    }
    
  };
  
  /**
   * Calling this function will toggle the enlargement of the map
   * instance. We cannot set the element itself to native fullscreen as
   * as this would cause modals to be hidden. Therefore markers need to
   * be added at various places to ensure the map stretches properly.
   * This includes marking ancestor dom nodes to be able to shift the
   * stacking context.
   */
  MapWidget.prototype.handleToggleFullscreen = function(useHalfscreen) {
    
    var fsapi = utils.getFullScreenApis();
        
    this.logger("log", "Toggled graph enlargement");
        
    if(this.enlargedMode) {
      
      // remove markers
      utils.findAndRemoveClassNames([
        "tmap-" + this.enlargedMode,
        "tmap-has-" + this.enlargedMode + "-child"
      ]);
      
      if(this.enlargedMode === "fullscreen") {
        document[fsapi["_exitFullscreen"]]();
      }
      
      // reset
      this.enlargedMode = null;
      
    } else {
            
      if(!useHalfscreen && !fsapi) {
        this.dialogManager.open("fullscreenNotSupported",
                           { dialog: { buttons: "ok_suppress" }});
        return;
      }

      this.enlargedMode = (this.isContainedInSidebar && useHalfscreen
                           ? "halfscreen"
                           : "fullscreen");
                           
      $tw.utils.addClass(this.parentDomNode, "tmap-" + this.enlargedMode);
        
      var pContainer = (this.isContainedInSidebar
                        ? this.sidebar
                        : document.getElementsByClassName("tc-story-river")[0]);
              
      $tw.utils.addClass(pContainer, "tmap-has-" + this.enlargedMode + "-child");        
      
      if(this.enlargedMode === "fullscreen") {
        document.documentElement[fsapi["_requestFullscreen"]](Element.ALLOW_KEYBOARD_INPUT);
      }
      
      this.notify("Activated " + this.enlargedMode + " mode");

    }
    
    this.handleResizeEvent();

  };
     
  MapWidget.prototype.handleGenerateWidget = function(event) {
    
    $tw.rootWidget.dispatchEvent({
      type: "tmap:tm-generate-widget",
      paramObject: { view: this.view.getLabel() }
    });
    
  };
  
  MapWidget.prototype.handleStorePositions = function(withNotify) {
    
    this.adapter.storePositions(this.network.getPositions(), this.view);
    if(withNotify) {
      this.notify("positions stored");
    }
    
  };
  
  MapWidget.prototype.handleEditFilters = function() {

    var pnf = utils.getPrettyFilter(this.view.getNodeFilter("expression"));
    var pef = utils.getPrettyFilter(this.view.getEdgeFilter("expression"));

    var param = {
      view: this.view.getLabel(),
      dialog: {
        preselects: {
          prettyNodeFilter: pnf,
          prettyEdgeFilter: pef 
        }
      }
    };
    
    this.dialogManager.open("editFilters", param, function(isConfirmed, outputTObj) {
      if(isConfirmed) {
        this.view.setNodeFilter(utils.getField(outputTObj, "prettyNodeFilter", pnf));
        this.view.setEdgeFilter(utils.getField(outputTObj, "prettyEdgeFilter", pef));
      }
    });
      
  };

  /**
   * Called by vis when the graph has stabilized itself.
   * 
   * ATTENTION: never store positions in a views map during stabilize
   * as this will affect other graphs positions and will cause recursion!
   * Storing positions inside vis' nodes is fine though
   */
  MapWidget.prototype.handleVisStabilizedEvent = function(properties) {
    
    if(!this.hasNetworkStabilized) {
      this.hasNetworkStabilized = true;
      this.logger("log", "Network stabilized after " + properties.iterations + " iterations");
      this.view.setStabilizationIterations(properties.iterations);
      var isFloatingMode = this.view.isEnabled("physics_mode");

      this.network.storePositions();
      this.setNodesMoveable(this.graphData.nodesById, isFloatingMode);
      
      if(this.doZoomAfterStabilize) {
        this.doZoomAfterStabilize = false;
        this.fitGraph(1000, 1000);
      }
    }
    
  };
  
  MapWidget.prototype.handleFocusNode = function(event) {
    this.network.focusOnNode(this.adapter.getId(event.param), {
      scale: 1, animation: true
    });
  };
  
  MapWidget.prototype.fitGraph = function(delay, duration) {
    
    window.clearTimeout(this.activeZoomExtentTimeout);
    
    var f = function() {
      this.network.zoomExtent({
        duration: duration
      });
      this.activeZoomExtentTimeout = 0; // reset to a non-existent index
    }.bind(this);
    
    if(delay) {
      this.activeZoomExtentTimeout = window.setTimeout(f, delay);
    } else {
      f();
    }
  }
  
  MapWidget.prototype.handleStartStabilizionEvent = function(properties) {
    
      //~ this.activeZoomExtentTimeout = this.network.zoomExtent({
        //~ duration: 2000
      //~ });

    
  };

  MapWidget.prototype.handleInsertNode = function(node) {
        
    this.dialogManager.open("getNodeTitle", null, function(isConfirmed, outputTObj) {
      if(isConfirmed) {
        
        var title = utils.getText(outputTObj);
        
        if(utils.tiddlerExists(title)) {
          
          if(utils.isMatch(title, this.view.getNodeFilter("compiled"))) {
            this.notify("Node already exists");
          } else {

            node = this.adapter.makeNode(title, node, this.view);
            this.view.addNodeToView(node);
            this.rebuildGraph();

          }
          
        } else {
        
          node.label = title;
          this.adapter.insertNode(node, {
            view: this.view,
            editNodeOnCreate: false
          });
          this.preventNextContextReset = true;
        
        }
      }
    });
    
  };
    
  /**
   * This handler is registered at and called by the vis network event
   * system.
   */
  MapWidget.prototype.handleVisSingleClickEvent = function(properties) {
    
    if(utils.isTrue(this.opt.config.sys.singleClickMode)) {
      this.handleVisClickEvent(properties);
    }
    
  };
    
  /**
   * This handler is registered at and called by the vis network event
   * system.
   * 
   * @see
   *   - Coordinates not passed on click/tap events within the properties object
   *     https://github.com/almende/vis/issues/440
   * 
   * @properties a list of nodes and/or edges that correspond to the
   * click event.
   */
  MapWidget.prototype.handleVisDoubleClickEvent = function(properties) {
    
    if(!properties.nodes.length && !properties.edges.length) { // clicked on an empty spot
      
      if(this.editorMode) {
        this.handleInsertNode(properties.pointer.canvas);
      }
      
    } else if(!utils.isTrue(this.opt.config.sys.singleClickMode)) {
      this.handleVisClickEvent(properties);
    }
    
  };
  
  MapWidget.prototype.handleVisClickEvent = function(properties) {
    
    if(properties.nodes.length) { // clicked on a node    
      
      this.openTiddlerWithId(properties.nodes[0]);
      
    } else if(properties.edges.length) { // clicked on an edge
      
      if(!this.editorMode) return;
      
      this.logger("debug", "Clicked on an Edge");
      
      var behaviour = this.opt.config.sys.edgeClickBehaviour;
      var type = new EdgeType(this.graphData.edgesById[properties.edges[0]].type);
      
      if(behaviour === "manager") {        
        $tw.rootWidget.dispatchEvent({
          type: "tmap:tm-manage-edge-types",
          paramObject: { type: type.getId() }
        });        
      }
    }

  };
  
  /**
   * Listener will be removed if the parent is not part of the dom anymore
   * 
   * @see
   *   - [TW5] Is there a destructor for widgets?
   *     https://groups.google.com/d/topic/tiddlywikidev/yuQB1KwlKx8/discussion
   *   - https://developer.mozilla.org/en-US/docs/Web/API/Node.contains
   */
  MapWidget.prototype.handleResizeEvent = function(event) {
    
    if(this.isContainedInSidebar) {
      
      var windowHeight = window.innerHeight;
      var canvasOffset = this.parentDomNode.getBoundingClientRect().top;

      var distanceBottom = this.getAttribute("bottom-spacing", "25px");
      var calculatedHeight = (windowHeight - canvasOffset) + "px";
      
      this.parentDomNode.style["height"] = "calc(" + calculatedHeight + " - " + distanceBottom + ")";
      
    } else {
      
      var height = this.getAttribute("height");
      this.parentDomNode.style["height"] = (height ? height : "300px");
      
    }

    if(this.network) {
      this.repaintGraph(); // redraw graph
    }
    
  };
    
  /**
   * used to prevent nasty deletion as edges are not unselected when leaving vis
   */
  MapWidget.prototype.handleClickEvent = function(event) {
    
    if(this.network) {
      var element = document.elementFromPoint(event.clientX, event.clientY);
      if(!this.parentDomNode.contains(element)) {
        var selected = this.network.getSelection();
        if(selected.nodes.length || selected.edges.length) {
          this.logger("debug", "Clicked outside; deselecting nodes/edges");
          this.network.selectNodes([]); // deselect nodes and edges
        }
      }
    }

  };
  
  /**
   * Called by vis when the dragging of a node(s) has ended.
   * @param {Object} properties - A vis object containing event-related
   *     information.
   * @param {Array<Id>} properties.nodeIds - Array of ids of the nodes
   *     that were being dragged.
   */
  MapWidget.prototype.handleVisDragEnd = function(properties) {
    
    if(properties.nodeIds.length) {
      var isFloatingMode = this.view.isEnabled("physics_mode");
      
      var node = this.graphData.nodesById[properties.nodeIds[0]];
      
      if(!isFloatingMode) { // only store positions if in floating mode
        
        // fix node again
        this.setNodesMoveable([ node ], false);
        
        var raster = parseInt(this.opt.config.sys.raster);
        if(raster) { // apply raster
          var pos = this.network.getPositions()[node.id];
          // only update x,y to prevent a lost update (allowedToMove stuff)
          this.graphData.nodes.update({
            id: node.id,
            x: pos.x - (pos.x % raster),
            y: pos.y - (pos.y % raster)
          });
        }
        
        // finally store positions
        this.handleStorePositions();
      }
    }
        
  };
  
  MapWidget.prototype.handleVisSelect = function(properties) {
    //
  };
  
  MapWidget.prototype.handleVisViewportChanged = function(properties) {
    this.doZoomAfterStabilize = false;
  };
  
  /**
   * Called by vis when a node is being dragged.
   * @param {Object} properties - A vis object containing event-related
   *     information.
   * @param {Array<Id>} properties.nodeIds - Array of ids of the nodes
   *     that are being dragged.
   */
  MapWidget.prototype.handleVisDragStart = function(properties) {
    if(properties.nodeIds.length) {
      var node = this.graphData.nodesById[properties.nodeIds[0]];
      this.setNodesMoveable([ node ], true);
    }
  };
   
  /**
   * called from outside.
   */
  MapWidget.prototype.destruct = function() {
    window.removeEventListener("resize", this.handleResizeEvent);
    window.removeEventListener("click", this.handleClickEvent);
    this.network.destroy();
  };
  
  /**
   * Opens the tiddler that corresponds to the given id either as
   * modal (when in fullscreen mode) or in the story river.
   */
  MapWidget.prototype.openTiddlerWithId = function(id) {
    
    var tRef = $tw.tmap.indeces.tById[id];
    
    this.logger("debug", "Opening tiddler", tRef, "with id", id);
    
    if(this.enlargedMode === "fullscreen") {
      
      this.dispatchEvent({
        type: "tm-edit-tiddler", tiddlerTitle: tRef
      });
      
      var draftTRef = this.wiki.findDraft(tRef);
      
      if(!draftTRef) return;
      
      var params = {
        param: { ref: draftTRef }
      };

      this.dialogManager.open("editContent", params,  function(isConfirmed, outputTObj) {
      
        if(isConfirmed) {
          
          this.dispatchEvent({
            type: "tm-save-tiddler", tiddlerTitle: draftTRef
          }); 
          
        } else {
          
          this.dispatchEvent({
            type: "tm-cancel-tiddler", tiddlerTitle: draftTRef
          });
          
        }
        
      });
      
    } else {
      
      this.dispatchEvent({
        type: "tm-navigate", navigateTo: tRef
      }); 
      
    }
  };
   
  /**
   * The view holder is a tiddler that stores a references to the current
   * view. If the graph is not bound to a view by the user via an
   * attribute, the default view holder is used. Otherwise, a temporary
   * holder is created whose value is set to the view specified by the user.
   * This way, the graph is independent from view changes made in a
   * tiddlymap editor.
   * 
   * This function will only calculate a new reference to the holder
   * on first call (that is when no view holder is registered to "this".
   * 
   */
  MapWidget.prototype.getViewHolderRef = function() {
    
    // the viewholder is never recalculated once it exists
    if(this.viewHolderRef) {
      return this.viewHolderRef;
    }
    
    this.logger("info", "Retrieving or generating the view holder reference");
    
    // if given, try to retrieve the viewHolderRef by specified attribute
    var viewName = this.getAttribute("view");
    if(viewName) {
      
      this.logger("log", "User wants to bind view \"" + viewName + "\" to graph");
            
      var viewRef = this.opt.path.views + "/" + viewName;
      if(this.wiki.getTiddler(viewRef)) {
        
        // create a view holder that is exclusive for this graph
        
        var holderRef = this.opt.path.localHolders + "/" + utils.genUUID();
        this.logger("log", "Created an independent temporary view holder \"" + holderRef + "\"");
        
        // we do not use setView here because it would store and reload the view unnecessarily...
        this.wiki.addTiddler(new $tw.Tiddler({ 
          title: holderRef,
          text: viewRef
        }));
        
        this.logger("log", "View \"" + viewRef + "\" inserted into independend holder");
        
      } else {
        this.logger("log", "View \"" + viewName + "\" does not exist");
      }
      
    }
    
    if(typeof holderRef === "undefined") {
      this.logger("log", "Using default (global) view holder");
      var holderRef =  this.opt.ref.defaultGraphViewHolder;
    }
    
    return holderRef;
    
  };
  
  /**
   * This function will switch the current view reference of the
   * view holder. If no viewRef is specified, the current view is
   * simply updated.
   * 
   * @viewRef (optional) a reference (tiddler title) to a view
   * @viewHolderRef (optional) a reference to the view holder that should be updated
   */
  MapWidget.prototype.setView = function(viewRef, viewHolderRef) {
    
    if(viewRef) {
      if(!viewHolderRef) {
        viewHolderRef = this.viewHolderRef;
      }
      this.logger("info", "Inserting view \"" + viewRef + "\" into holder \"" + viewHolderRef + "\"");
      this.wiki.addTiddler(new $tw.Tiddler({ 
        title : viewHolderRef,
        text : viewRef
      }));
    }
    
    // register the new value; no need to update the adapter as this is done during refresh
    this.view = this.getView(true);
  };
  
  /**
   * This function will return a view abstraction that is based on the
   * view specified in the view holder of this graph.
   * 
   * @param {boolean} isRebuild - Retrieve the view reference again
   *     from the holder and recreate the view abstraction object.
   * @return {ViewAbstraction} the view
   */
  MapWidget.prototype.getView = function(isRebuild) {
    
    if(!isRebuild && this.view) {
      return this.view;
    }
    
    var viewHolderRef = this.getViewHolderRef();
                       
    // transform into view object
    var view = new ViewAbstraction(utils.getText(viewHolderRef));
    
    this.logger("info", "Retrieved view \"" + view.getLabel() + "\" from holder \"" + viewHolderRef + "\"");
    
    if(view.exists()) {
      return view;
    } else {
      this.logger("log", "Warning: View \"" + view.getLabel() + "\" doesn't exist. Default is used instead.");
      return new ViewAbstraction("Default");
    }
    
  };
  
  /**
   * using an existing dataset to reflect the changes between
   * two node sets.
   * 
   * @param {Hashmap<id, Node>} lt1 - Lookup table that contains the
   *     *new* set of nodes.
   * @param {Hashmap<id, Node>} lt2 - lookup table that holds the
   *     *old* set of nodes.
   * @param {vis.DataSet} [ds] - The dataset to be updated
   */
  MapWidget.prototype.getRefreshedDataSet = function(ltNew, lTOld, ds) {
    
    if(!ds) {
      return new vis.DataSet(utils.convert(ltNew, "array"));
    }
    
    // first remove
    var removes = [];
    for(var id in lTOld) {
      if(!ltNew[id]) {
        removes.push(id);
      }
    }
    ds.remove(removes);
    
    // get all nodes that remain after the remove operation
    var existing = ds.get({ returnType: "Object" });
    
    var updates = [];
    for(var id in ltNew) {
      var update = ltNew[id];
      
      if(existing[id]) { // node already exists in graph
        for(var prop in existing[id]) {
          // some stuff like x and y should remain
          if(prop == "x" || prop == "y") continue;
          // explicitly set to null to prevent relicts
          if(update[prop] === undefined) {
            update[prop] = null;
          }
        }
      }
      // now push
      updates.push(update);
    }
    ds.update(updates);
    
    return ds;
    
  };

  /**
   * Repaint this graph instance if
   * 1. fullscreen is not possible at all
   * 2. no part of the document is running in fullscreen
   *    (halfscreen does not count)
   * 3. this graph instance is currently running fullscreen.
   */
  MapWidget.prototype.repaintGraph = function() {
    
    var fsapi = utils.getFullScreenApis();

    if(!fsapi || !document[fsapi["_fullscreenElement"]] || this.enlargedMode) {
    
      this.logger("info", "Repainting the whole graph");
    
      this.network.redraw();
      this.fitGraph(0, 1000);
      
    }
    
  };
    
  /**
   * If a button is enabled it means it is displayed on the graph canvas.
   * 
   * @param {string} name - The name of the button to enabled. Has to
   *     correspond with the css button name.
   * @param {boolean} enable - True if the button should be visible,
   *     false otherwise.
   */ 
  MapWidget.prototype.setGraphButtonEnabled = function(name, enable) {
    var className = "network-navigation tmap-vis-button" + " " + "tmap-" + name;
    var b = this.parentDomNode.getElementsByClassName(className)[0];
    $tw.utils.toggleClass(b, "tmap-button-enabled", enable);
  }; 
  
  
  /**
   * Allow the given nodes to be moveable.
   * 
   * @param {vis.DataSet} nodes - The nodes for which to allow any
   *     movement (either by physics or by dragging).
   * @param {boolean} isEnabled - True, if the nodes are allowed to
   *     move or be moved.
   */    
  MapWidget.prototype.setNodesMoveable = function(nodes, isMoveable) {
  
    this.network.storePositions();

    var updates = [];
    var keys = Object.keys(nodes);
    for(var i = 0; i < keys.length; i++) {
      
      var id = nodes[keys[i]].id;
      
      var update = {
        id: id,
        allowedToMoveX: isMoveable,
        allowedToMoveY: isMoveable
      };
      
      updates.push(update);
      
    }

    this.graphData.nodes.update(updates);

  };

  /**
   * This function will create the dom elements for all tiddlymap-vis
   * buttons and register the event listeners.
   * 
   * @param {Object<string, function>} buttonEvents - The label of the
   *     button that is used as css class and the click handler.
   */
  MapWidget.prototype.addGraphButtons = function(buttonEvents) {
    
    var parent = this.parentDomNode.getElementsByClassName("vis network-frame")[0];
    
    for(var name in buttonEvents) {
      
      var div = document.createElement("div");
      div.className = "network-navigation tmap-vis-button " + " " + "tmap-" + name;
      div.addEventListener("click", buttonEvents[name].bind(this), false);
      parent.appendChild(div);
      
      this.setGraphButtonEnabled(name, true);
      
    }
    
  };
  
  /*** TO AVOID STRANGE LIB ERROS FROM BUBBLING UP *****************/
  
  if($tw.boot.tasks.trapErrors) {
    
    var defaultHandler = window.onerror;
    window.onerror = function(errorMsg, url, lineNumber) {
      console.log("er123", arguments, $tw.tmap.utils.hasSubString(errorMsg, "NS_ERROR_NOT_AVAILABLE"), url);
      if($tw.tmap.utils.hasSubString(errorMsg, "NS_ERROR_NOT_AVAILABLE")
         && url == "$:/plugins/felixhayashi/vis/vis.js") {
        console.error("Strange firefox related vis.js error (see https://github.com/felixhayashi/TW5-TiddlyMap/issues/125)", arguments);
      } else if(defaultHandler) {
        defaultHandler.apply(this, arguments);
      }

    }
  }
  
  /*** Export ******************************************************/
  
  exports.tiddlymap = MapWidget;
  
})();

