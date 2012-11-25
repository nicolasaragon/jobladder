/**
	Use native browser JSON support by means of:
	
	var json_text = JSON.stringify(your_object);
	var your_object = JSON.parse(json_text);

*/
var serempre = new function(){
	this.cargos = new function(){
		//this is 'work queue'... all objects in this collection are primary keys for objects to be processed
		this.pendingCargos = [];
		//collection of leaf nodes
		this.destinations = [];
		//an object that acts as if it were a hash table to keep track of visited objects
		this.futurePaths = {};
		//a copy of the traversed graph that can be used in between pages throughout this site
		this.toStringify = "";
		
		//use scrap data from futurePaths to calculate all possible routes
		this.rebuildPaths = function(){
			//this will have a pointer for each node visited in the graph
			var keys = [];
			//collect pointers for all visited objects
			for(var key in this.futurePaths){
				keys[keys.length] = key;
			}
			//console.log(keys);
			//for each visited object, build a js statement to get a handle on it's data
			for(var i = 0; i < keys.length; i++){
				//plain text js statement that points to a graph object
				var node = "this.futurePaths['" + keys[i] + "']";
				//console.log(keys[i]);
				//console.log(node);
				//console.log(eval(node));
				//evaluate js statement to grab the object
				node = eval(node);
				//console.log(node.fields.siguientes);
				//for every node referenced by the current object
				for(var j = 0; j < node.fields.siguientes.length; j++){
					//console.log('-->'+ node.fields.siguientes[j]);
					//plain text js statement that points to the reference target
					var reference = "this.futurePaths['" + node.fields.siguientes[j] + "']";
					//evaluate js statement to grab the reference target
					reference = eval(reference);
					//replace target key with actual object reference
					node.fields.siguientes[j] = reference;
					//console.log(reference);
				}
			}
		}
		
		this.startStep = function (serviceURL, callback){
			//if there are pending nodes to process
			if(serempre.cargos.pendingCargos.length > 0){
				//get the first pending node
				var node_pk = serempre.cargos.pendingCargos[0];
				var node = serempre.cargos.futurePaths[ node_pk ];
				serempre.cargos.pendingCargos = serempre.cargos.pendingCargos.slice(1, serempre.cargos.pendingCargos.length);
				//skip all nodes already available
				while(node){
					node_pk = serempre.cargos.pendingCargos[0];
					node = serempre.cargos.futurePaths[ node_pk ];
					serempre.cargos.pendingCargos = serempre.cargos.pendingCargos.slice(1, serempre.cargos.pendingCargos.length);
				}
				//fetch a node from the server. Upon completion trigger this function again
				if( !node ){
					$.ajax({
						url: serviceURL.slice(0,-2) + node_pk + "/"
						, dataType: "json"
						, success: function(data, textStatus, jqXHR){
							//if the server-side data points to any other graph nodes, then schedule them for future processing
							if(data[0]){
								serempre.cargos.stopStep(data[0]);
							} 
							//if server-side data doesn't point to any other nodes
							if( data[0].fields.siguientes.length <= 0 ) {
								//this is a leaf. Save it for later use
								serempre.cargos.destinations[ serempre.cargos.destinations.length ] = node;
							}
						}
						, error: function(jqXHR, textStatus, errorThrown){
							alert(textStatus);
						}
						, complete: function(jqXHR, textStatus){
							serempre.cargos.startStep(serviceURL, callback);
						}
					});
				}
			} 
			else{
				sessionStorage.futurePaths = '{' + serempre.cargos.toStringify.slice(1,this.toStringify.length) + '}';
				sessionStorage.destinations = JSON.stringify(serempre.cargos.destinations);
				serempre.cargos.rebuildPaths();
				callback();
				serempre.cargos.toggleWaitDialog();
			}
		}
		
		this.stopStep = function(node){
			serempre.cargos.futurePaths[ node.pk ] = node;
			serempre.cargos.toStringify += ',"' + node.pk + '":' + JSON.stringify(node);
			for(var i = 0; i < node.fields.siguientes.length; i++){
				var node_pk = node.fields.siguientes[i];
				if( !serempre.cargos.futurePaths[ node_pk ] ){
					serempre.cargos.pendingCargos[ serempre.cargos.pendingCargos.length ] = node_pk;
				}
			}
		}
		
		//calculate available career routes from a given starting point
		//offSet: stands for a server-side primary key
		this.calculateRouteEndpoints = function(offSet, serviceURL, callback, wait_message, wait_icon){
			//clear work queue
			this.pendingCargos = [];
			//clear previous results, if any
			this.destinations = [];
			this.futurePaths = {};
			this.toStringify = "";
			//queue a graph node for processing
			this.pendingCargos[this.pendingCargos.length] = offSet;
			//show please wait dialog
			this.toggleWaitDialog(wait_message ? wait_message : 'Estamos buscando planes de carrera a partir del cargo que ocupas', wait_icon ? wait_icon : 'icon-filter');
			//trigger graph walking algorithm
			serempre.cargos.startStep(serviceURL, callback);
			//this.calculateRouteEndpoints_inspectChildrenFor(serviceURL, callback);
		}
		
		//load all available cargos
		this.loadOffsetCargos = function(serviceURL, jq_selector_for_destination_select,wait_message,wait_icon){
			//show please wait dialog
			this.toggleWaitDialog(wait_message ? wait_message : 'Estamos cargando los cargos que puedes ocupar en la organización', wait_icon ? wait_icon : 'icon-signal');
			$.ajax({
				url: serviceURL
				, dataType: "json"
				, data: {
					//don't send any data to the service
				}, success: function(data, textStatus, jqXHR){
					serempre.cargos.populateDropdownOptions(data, jq_selector_for_destination_select);
				}, complete: function(jqHXR, textStatus){
					//done requesting data
					serempre.cargos.toggleWaitDialog();
				}, error: function(jqXHR, textStatus, errorThrown){
					alert(textStatus);
				}
			});
		}
		
		//prepare wait dialog
		this.setupWaitDialog = function(){
			$(document.body).append("<div id='dialog-wait' title='Por favor espera...'><div class='control-group warning'><p style='margin-top: 5px;'><i class='icon-road' style='margin: 3px 7px 0px 7px; float: left;'></i><span id='msg-content'>Estamos calculando tus planes de carrera</span><p></div></div>");
			$( "#dialog-wait" ).dialog({
				resizable: false,
				height:140,
				modal: true,
				autoOpen: false,
				closeOnEscape: false,
				show: 'explode',
				hide: 'explode',
			});
		}
		
		//hides or shows the please wait dialog
		//text: text you want displayed by the wait dialog
		//icon: bootstrap glyphicon style for the dialog image
		this.toggleWaitDialog = function(text, icon){
			//find out if dialog is opened up
			if($("#dialog-wait").dialog( "isOpen" )){
				//if dialog is opened up, then close it
				$("#dialog-wait").dialog( "close" );
			}else {
				if(text){
					$('#dialog-wait #msg-content').text(text);
				}
				if(icon){
					var iconImage = $('#dialog-wait i');
					var currentStyle = iconImage.attr('class');
					iconImage.removeClass(currentStyle).addClass(icon);
				}
				//display dialog
				$("#dialog-wait").dialog( "open" );
				//hide the close dialog handle
				var closeLink = $('a.ui-dialog-titlebar-close', $('#dialog-wait').prev()).remove();
				if(closeLink.length>0)
					$('#dialog-wait').prev().prepend($("<span class='background_jobs_pending'></span>"));
			}
		}
		
		//iterates trough whatever contents are in the array or object represented by 'data'
		//data: info to be used when populating a drop down list
		//jqSelectorForDropown: jquery selector that points to the dropdown where data is to be appended
		this.populateDropdownOptions = function(data, jqSelectorForDropown){
			$(jqSelectorForDropown+' option').remove()
			$.map( data, function( item ) {
				$(jqSelectorForDropown).append(
					$('<option value="' + item.pk + '">' + item.fields.nombre + '</option>')
				);
			})
		}
		
		//returns true if a key native function is missing
		this.No_HTML5 = function(){
			var user_msg = 'aborting';
			var log_msg = 'aborting';
			var abort = false;
			//make sure this browser can use local storage api
			if(typeof(Storage)=="undefined"){
				user_msg = 'Your browser does not support HTML5 storage';
				log_msg = 'No HTML5 storage API';
				abort = true;
			}
			//make sure this browser can serialize data as json
			if( (! JSON.parse) || (! JSON.stringify ) ){
				user_msg = 'Your browser is not supported';
				log_msg = 'native JSON stringify or parse not available';
				abort = true;
			}
			//if browser lacks required API, then let the user know about it
			if(abort){
				alert(user_msg);
				console.log(log_msg);
			}
			return abort;
		}
	}	
};
