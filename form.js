M.wrap('github/jillix/bind-form/dev/form.js', function (require, module, exports) {
var Events = require('github/jillix/events');
var data = require('./data');
var ui = require('./ui');

function setTemplate (template) {
    var self = this;
    
    // check tempalte
    if (typeof template !== 'object' || !template.id) {
        // TODO cache templates
        return self.emit('getTemplates', [template], function (err, templates) {
            
            // TODO handle error
            if (err || !templates[template]) {
                return;
            }
            
            //set current tempalte
            self.template = templates[template];
            self.emit('templateSet');
        });
    }
    
    //set current tempalte
    self.template = template;
    self.emit('templateSet');
}

function init (config) {
    var self = this;
    
    self.config = config;
    
    if (!config.crud) {
        return console.error('No crud miid defined.');
    }
    
    // wait for the crud module
    self.onready(config.crud, function () {
        
        // init ui
        if (self.config.ui) {
            ui.call(self);
        }
        
        // init data events
        data.call(self);
        
        // set template
        self.on('setTemplate', setTemplate);
        
        // listen to external events
        Events.call(self, config);
        
        self.emit('ready');
    });
}

module.exports = init;

return module; });
