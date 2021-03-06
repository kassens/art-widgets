/*
	Manages z-index ordering of objects as well as their enabled state.
*/

var Stacker = new Class({

	Implements: [Options, Events],

	options: {
		//the base z-index for the first item in the stack; every other item is incrementally higher
		zIndexBase: 0,
		//when cascading, the offset to use
		offset: {
			x: 20,
			y: 10
		}
	},

	instances: [],

	initialize: function(options) {
		this.setOptions(options);
		this.layers = $H();
		this.setLayer('default');
	},

	/*
		sets / creates a layer and assigns it a zIndex
		zIndex defaults to the one in the options.
		a layer an object w/ a zIndex, name, and an array of the instance in that layer
	*/
	
	
	setLayer: function(name, zIndex) {
		zIndex = zIndex == undefined ? this.options.zIndexBase : zIndex;
		if (this.layers[name]) {
			this.layers[name].zIndex = zIndex;
		} else {
			this.layers[name] = {
				zIndex: zIndex,
				name: name,
				instances: []
			};
		}
		return this.getLayer(name);
	},

	//retrieves a layer given a name; will create it if not found
	getLayer: function(name, defaultZIndex) {
		if (!this.layers[name]) this.setLayer(name, defaultZIndex);
		return this.layers[name];
	},

	//registers an instance on a layer (registers it in the default layer if none specified)
	register: function(instance, layer){
		layer = layer || 'default';
		//if the instance was previously registered, move it to the new layer
		var registered = this.instances.contains(instance);
		if (registered && this.getLayerForInstance(instance)) {
			var instanceLayer = this.getLayerForInstance(instance);
			if (instanceLayer == layer) return;
			instanceLayer.instances.erase(instance);
		} else  {
			$(instance).addEvent('mousedown', function(){
				if (instance.disabled) this.enable(instance);
			}.bind(this));
			this.instances.include(instance);
		}
		if (!this.layers[layer]) this.getLayer(layer, this.options.zIndexBase);
		this.layers[layer].instances.include(instance);
	},

	//removes an instance from this stacker's control
	unregister: function(instance) {
		var refocus = this.enabled == instance;
		var iLayer = this.getLayerForInstance(instance);
		this.instances.erase(instance);
		this.layers.each(function(layer) {
			if (layer.instances.contains(instance)) layer.instances.erase(instance);
		});
		if (refocus) {
			if (iLayer.instances.length) {
				this.enable(iLayer.instances[iLayer.instances.length -1]);
			} else if (this.instances.length){
				this.enable(this.instances[this.instances.length -1]);
			}
		}
	},

	//retrieves the layer for a given instance
	getLayerForInstance: function(instance) {
		var ret;
		this.layers.each(function(layer) {
			if (layer.instances.contains(instance)) ret = layer;
		});
		return ret;
	},

	//z-index orders a layer so that a specific instance is on top
	bringToFront: function(instance){
		if (!instance || (instance == this.enabled && instance.stacked)) return;
		this.layers.each(function(layer) {
			var i = 0;
			if (!layer.instances.contains(instance)) return;
			layer.instances.erase(instance).push(instance);
			this.stack(layer);
		}, this);
	},

	//assigns the zindex order for all the instances in a layer based on their order
	stack: function(layer) {
		layer.instances.each(function(win, i){
			$(win).setStyle('z-index', layer.zIndex + (i*2));
			win.stacked = true;
		}, this);
	},

	//cycles the zIndex for a given layer forward or back
	cycle: function(direction, layerName) {
		direction = direction || 'forward';
		var instances = this.layers[layerName].instances;
		if (direction == 'forward') instances.push(instances.shift());
		else instances.unshift(instances.pop());
		this.stack(this.layers[layerName]);
		this.enable(instances[instances.length -1], true);
	},

	//enables an instance, (optionally) bringing it to front
	enable: function(instance, noOrder){
		if (!instance || (instance == this.enabled && instance.stacked)) return;
		if (!noOrder) this.bringToFront(instance);
		//TODO make this shit not so fucking slow
		if (this.enabled && this.enabled != instance) this.enabled.disable();
		if (instance.disabled) instance.enable(true);
		this.enabled = instance.focus();
	},

	//moves all the instances to be in a cascaded line
	cascade: function(layer, x, y){
		x = $pick(x, this.options.offset.x);
		y = $pick(y, this.options.offset.y);
		this.layers[layer].instances.each(function(current, i){
			var styles = {top: (y * i) + y, left: (x * i) + x};
			$(current).setStyles(styles);
		});
	},

	//positions new instances based on the current location of the focused instance
	positionNew: function(instance, options){
		var pos = true;
		//if there are no instances other than this one, or one instance
		//or the position is not set or is equal to the enabled instances options
		//then return; and let the window be positioned as the class would normally.
		var current;
		var instances = this.getLayerForInstance(instance).instances.filter(function(instance){
			return !instance.hidden && $(instance);
		});
		instances.reverse().some(function(win){
			if (win != instance && $(win) && $(win).getStyle('display') != 'none') {
				current = win;
				return true;
			}
		});
		if (options) {
			//if the position is not defined in the options
			//or, if it is, the position is the same as the enabled instance's options
			//such that opening with the same options will place them on top of each other
			//(assuming the first one hasn't moved)
			pos = ['top', 'left', 'edge', 'position', 'relativeTo'].every(function(opt){
				curOpt = current ? current.options[opt] : null;
				return curOpt == options[opt];
			}, this);
		}
		this.enable(instance);
		if (instances.length < 1 || !pos || !current) return false;
		//position near the enabled instance, with an offset as defined in the options
		$(instance).position({
			relativeTo: $(current),
			offset: this.options.offset,
			edge: 'upperLeft',
			position: 'upperLeft'
		});
		pos = instance.element.getPosition();
		var size = instance.element.getSize();
		var bottom = pos.y + size.y;
		var right = pos.x + size.x;
		var containerSize = $(document.body).getSize();
		if (bottom > containerSize.y || right > containerSize.x) {
			$(instance).position({
				relativeTo: instance.options.inject.target,
				offset: this.options.offset,
				edge: 'upperLeft',
				position: 'upperLeft'
			});
		}
		
		return true;
	}
	
});