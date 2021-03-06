var Bind = require ('github/jxmono/bind');
    
// TODO use bind for dom interaction/manipulation
function elm(d,a) {
    try {
        var b = document.createElement(d);
        if ('object' === typeof a) {
            for (var c in a) {
                if (!a.hasOwnProperty(c)) continue;

                if (typeof a[c] === 'object' && a[c] instanceof Array) {
                    b.setAttribute(c, a[c].join(', '));
                } else {
                    b.setAttribute(c, a[c]);
                }
            }
            return b;
        }
    } catch (e) {
        return null;
    }
}
function get(s,c) {
    try {
        return (c||document).querySelector(s);
    } catch (err) {
        return null;
    }
}
function getAll(s,c){
    try{return (c||document).querySelectorAll(s);}
    catch (err) {
        return null;
    }
}

var fields = require('./ui/fields');
var controls = require('./ui/controls');
var progress = require('./ui/progress');

var formCache = {};

function getDomRefs (form) {
    var self = this;
    
    // return if no schema is defined
    if (!self.template.schema) {
        return;
    }

    var domRefs = {};
    var label, value, selectors;
    
    // get dom refs
    for (var field in self.template.schema) {
        if (!self.template.schema.hasOwnProperty(field)) continue;

        selectors = self.template.schema[field].selectors;
        if (!selectors) {
            continue;
        }

        domRefs[field] = {};
        
        // get the label field
        if (selectors.label && (label = getAll(selectors.label, form))) {
            
            for (var i = 0, l = label.length; i < l; ++i) {
                // handle i18n
                var labelValue = self.template.schema[field].label;
                if (typeof labelValue === 'object') {
                    label[i].innerHTML = labelValue[M.getLocale()];
                } else {
                    label[i].innerHTML = labelValue;
                }
            }
            
            domRefs[field].label = label;
        }

        // get the value field
        if (value = getAll(selectors.value, form)) {
            for (var i = 0, l = value.length, tagName; i < l; ++i) {
                // set the html if the value is not an input
                if (['INPUT', 'SELECT', 'TEXTAREA'].indexOf(value[i].tagName) === -1) {
                    // set html to true to use innerHTML
                    value[i].html = true;
                    value[i].attr = selectors.attr;
                }
            }

            domRefs[field].value = value;

            // add event listeners
            for (var i = 0; i < value.length; ++i) {
                // do not add event listeners if this is not an input
                if (['INPUT', 'SELECT', 'TEXTAREA'].indexOf(value[i].tagName) === -1) {
                    continue;
                }

                // TODO
                // this is a flag used to control the state and future operation on this field
                // this will have $set or $unset values
                domRefs[field].control = '$set';

                // ignore SELECT tags, Checkboxes and radios
                if (value[i].tagName !== 'SELECT' && value[i].getAttribute('type') !== 'checkbox' && value[i].getAttribute('type') !== 'radio') {
                    // data change event

                    var dcEvents = self.config.options.dataChanged;
                    
                    // convert string to array
                    if (typeof dcEvents === "string") {
                        dcEvents = [dcEvents];
                    }

                    // listen to change if other event is not provided
                    if (dcEvents.length === 0) {
                        dcEvents.push('change');
                    }
                } else {
                    dcEvents = ['change'];
                }

                // listen each event in dcEvents array
                for (var j = 0; j < dcEvents.length; ++j) {
                    (function (field) {
                        value[i].addEventListener(dcEvents[j], function () {

                            var fieldValue;

                            // checkboxes need a special treatment
                            switch (this.getAttribute('type')) {
                                case 'checkbox':
                                    fieldValue = this.checked;
                                    break;
                                default:
                                    fieldValue = this.value;
                            }

                            self.emit('dataChanged', self.template._id, field, fieldValue, this);
                        }, false);
                    })(field);
                }
            }
        }
    }
    
    return domRefs;
}

function getTemplateHtml () {
    var self = this;
    
    // return if template has no html
    if (!(self.template.options || {}).html) {
        return;
    }
    
    // get the html
    if (!self.formCache[self.template._id]) {

        var htmlToGet = self.template.options.html;

        // handle i18n
        if (typeof htmlToGet === 'object') {
            htmlToGet = htmlToGet[M.getLocale()];
        }

        // no HTML, no fun
        if (!htmlToGet) { return; }

        self.link(htmlToGet, function (err, html) {

            // no HTML, no fun
            if (err) { return; }
            
            // append form to the dom
            self.target.innerHTML = html;

            // form fields have been rendered
            self.emit('fieldsRendered', self.target);

            // cache form
            self.formCache[self.template._id] = {
                dom: self.target,
                html: html,
                refs: getDomRefs.call(self, self.target)
            };

            finishFormRendering.call(self);
        });
    } else {
        // append form to the dom
        self.target.innerHTML = self.formCache[self.template._id].html;

        // form fields have been rendered
        self.emit('fieldsRendered', self.target);

        self.formCache[self.template._id].dom = self.target;
        self.formCache[self.template._id].refs = getDomRefs.call(self, self.target);

        finishFormRendering.call(self);
    }

}

function finishFormRendering () {
    var self = this;
    var targets = self.config.ui.targets;
    var TARGETS_TO_LOAD = Object.keys(targets).length - 1;

    if (targets['form'] && TARGETS_TO_LOAD == 0) {
        self.emit('formRendered', self.target, self.template);
        return;
    }

    for (var target in targets) {
        if (!targets.hasOwnProperty(target) || target === 'form') continue;

        // uninit the loaded module
        if (self.modules[target]) {
            self.uninit(target);
            delete self.modules[target];
        }

        // search the target container in the DOM containing also the template HTML
        self[target] = get(targets[target], self.dom);

        // load the target module in the container (if available)
        if (self[target]) {
            (function (target) {
                M(self[target], target, function(err) {

                    // when module is ready, tell him the template
                    self.on('ready', target, function() {
                        self.modules[target] = target;

                        // tell everybody interested that we are done
                        if (!--TARGETS_TO_LOAD) {
                            self.emit('formRendered', self.target, self.template);
                            self.emit('setTargetTemplate', self.template);
                        }
                    });
                });
            })(target);
        } else {
            if (!--TARGETS_TO_LOAD) {
                self.emit('formRendered', self.target, self.template);
            }
        }
    }
}

function autoFocus () {
    var self = this;

    if (!self.config.ui.autofocus) {
        return;
    } else {
        var target = self.config.ui.target;

        $elem = $(target + ' input[type="number"], ' + target + ' input[type="email"], ' + target + ' input[type="text"], ' + target + ' textarea, ' + target + ' select');

        //TODO find a better sollution
        setTimeout(function(){
            $elem.first().focus();
        }, 0);
    }
}

function init () {
    var self = this;

    // get form target
    if (!self.config.ui.targets || !self.config.ui.targets.form || !(self.target = get(self.config.ui.targets.form, self.dom))) {
        return;
    }

    // run the binds
    for (var i = 0; i < self.config.binds.length; ++i) {
        Bind.call(self, self.config.binds[i]);
    }
    
    // default value for dataChanged
    self.config.options.dataChanged = self.config.options.dataChanged || [];

    // default value for modules
    self.modules = {};

    // attach cache to module
    self.formCache = formCache;
    
    // handle template
    self.on('templateSet', getTemplateHtml);
    
    // init fields rendering
    self.once('formRendered', function () {
        
        fields.call(self);
        
        // init controls
        if (self.config.ui.controls) {
            controls.call(self);
        }
    });
    
    // init progress handling
    if (self.config.ui.progress) {
        progress.call(self);
    }
    
    // handle save
    self.on('dataUpdated', function (callback) {
        self.emit('saveCrud', callback);
    });
    self.on('save', function (callback) {
        self.emit('updateData', callback);
    });

    //handle autofocus
    self.on('formFilled', autoFocus);
}

module.exports = init;
