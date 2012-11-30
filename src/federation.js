var _enabled = true;
var _blacklisting = true;

postal.fedx = _.extend({

  _lastOrigin: [],

  clients: {},

  transports: {},

  constraints: {},

  addClient: function(options) {
    var client = this.clients[options.id];
    if(!client) {
      client = this.clients[options.id] = {
        activeTransport: options.type
      };
      client.send = function(payload, transport) {
        transport = transport || client.activeTransport;
        client[transport].send(payload);
      };
    }
    if(!client[options.type]) {
      client[options.type] = {
        send: options.send
      };
      if(options.postSetup) {
        options.postSetup();
      }
    }
  },

  blacklistMode: function() {
    _blacklisting = true;
  },

  canSendRemote: function(channel, topic) {
    var channelPresent = this.constraints.hasOwnProperty(channel);
    var topicMatch = (channelPresent && _.any(this.constraints[channel], function(binding){
      return postal.configuration.resolver.compare(binding, topic);
    }));

    return _enabled &&
      channel !== postal.configuration.SYSTEM_CHANNEL &&
      (
        (_blacklisting && (!channelPresent || (channelPresent && !topicMatch))) ||
          (!_blacklisting && channelPresent && topicMatch)
        );
  },

  disable: function() {
    _enabled = false;
  },

  enable: function() {
    _enabled = true;
  },

  getFedxWrapper: function(type) {
    return {
      postal     : true,
      type       : type,
      instanceId : postal.instanceId
    }
  },

  onFederatedMsg: function(payload, originId) {
    this._lastOrigin = [originId];
    postal.publish(payload.envelope);
    this._lastOrigin = [];
  },

  send : function(payload) {
    _.each(this.clients, function(client, id) {
      if(!_.include(this._lastOrigin, id)) {
        client.send(payload);
      }
    }, this);
  },

  signalReady: function(transportName) {
    if(transportName) {
      this.transports[transportName].signalReady();
    } else {
      _.each(this.transports, function(transport) {
        transport.signalReady();
      }, this);
    }
  },

  whitelistMode: function() {
    _blacklisting = false;
  }

}, postal.fedx);

postal.addWireTap(function(data, envelope){
  if(postal.fedx.canSendRemote(envelope.channel, envelope.topic)) {
    envelope.originId = envelope.originId || postal.instanceId;
    postal.fedx.send(_.extend({ envelope: envelope }, postal.fedx.getFedxWrapper('message')));
  }
});