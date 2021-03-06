/**
 * Copyright 2013 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

var RED = require(process.env.NODE_RED_HOME+"/red/red");
var reconnect = RED.settings.mysqlReconnectTime || 30000;
var mysqldb = require('mysql');
var querystring = require('querystring');

RED.app.get('/MySQLdatabase/:id',function(req,res) {
    var credentials = RED.nodes.getCredentials(req.params.id);
    if (credentials) {
        res.send(JSON.stringify({user:credentials.user,hasPassword:(credentials.password&&credentials.password!="")}));
    } else {
        res.send(JSON.stringify({}));
    }
});

RED.app.delete('/MySQLdatabase/:id',function(req,res) {
    RED.nodes.deleteCredentials(req.params.id);
    res.send(200);
});

RED.app.post('/MySQLdatabase/:id',function(req,res) {
    var body = "";
    req.on('data', function(chunk) {
        body+=chunk;
    });
    req.on('end', function(){
        var newCreds = querystring.parse(body);
        var credentials = RED.nodes.getCredentials(req.params.id)||{};
        if (newCreds.user == null || newCreds.user == "") {
            delete credentials.user;
        } else {
            credentials.user = newCreds.user;
        }
        if (newCreds.password == "") {
            delete credentials.password;
        } else {
            credentials.password = newCreds.password||credentials.password;
        }
        RED.nodes.addCredentials(req.params.id,credentials);
        res.send(200);
    });
});


function MySQLNode(n) {
    RED.nodes.createNode(this,n);
    this.host = n.host;
    this.port = n.port;
    
    this.connected = false;
    this.connecting = false;
    
    if (n.user) {
        var credentials = {};
        credentials.user = n.user;
        credentials.password = n.pass;
        RED.nodes.addCredentials(n.id,credentials);
        this.user = n.user;
        this.password = n.pass;
    } else {
        var credentials = RED.nodes.getCredentials(n.id);
        if (credentials) {
            this.user = credentials.user;
            this.password = credentials.password;
        }
    }
        
    this.dbname = n.db;
    var node = this;

    function doConnect() {
        node.connecting = true;
        node.connection = mysqldb.createConnection({
            host : node.host,
            port : node.port,
            user : node.user,
            password : node.password,
            database : node.dbname,
            insecureAuth: true
        });

        node.connection.connect(function(err) {
            node.connecting = false;
            if (err) {
                node.warn(err);
                node.tick = setTimeout(doConnect, reconnect);
            } else {
                node.connected = true;
            }
        });

        node.connection.on('error', function(err) {
            node.connected = false;
            if (err.code === 'PROTOCOL_CONNECTION_LOST') {
                doConnect(); // silently reconnect...
            } else {
                node.error(err);
                doConnect();
            }
        });
    }
    
    this.connect = function() {
        if (!this.connected && !this.connecting) {
            doConnect();
        }
    }
    
    this.on('close', function () {
        if (this.tick) { clearTimeout(this.tick); }
        if (this.connection) {
            node.connection.end(function(err) {
                if (err) node.error(err);
            });
        }
    });
}
RED.nodes.registerType("MySQLdatabase",MySQLNode);


function MysqlDBNodeIn(n) {
    RED.nodes.createNode(this,n);
    this.mydb = n.mydb;
    this.mydbConfig = RED.nodes.getNode(this.mydb);

    if (this.mydbConfig) {
        this.mydbConfig.connect();
        var node = this;
        node.on("input", function(msg) {
            if (typeof msg.topic === 'string') {
                //console.log("query:",msg.topic);
                node.mydbConfig.connection.query(msg.topic, function(err, rows) {
                    if (err) { node.warn(err); }
                    else {
                        msg.payload = rows;
                        node.send(msg);
                    }
                });
            }
            else {
                if (typeof msg.topic !== 'string') node.error("msg.topic : the query is not defined as a string");
            }
        });
    }
    else {
        this.error("MySQL database not configured");
    }
}
RED.nodes.registerType("mysql",MysqlDBNodeIn);


//function MysqlDBNodeOut(n) {
    //RED.nodes.createNode(this,n);
    //this.level = n.level;
    //this.operation = n.operation;
    //this.levelConfig = RED.nodes.getNode(this.level);

    //if (this.levelConfig) {
        //var node = this;
        //node.on("input", function(msg) {
            //if (typeof msg.topic === 'string') {
                //if (node.operation === "delete") {
                    //node.levelConfig.db.del(msg.topic);
                //}
                //else {
                    //node.levelConfig.db.put(msg.topic, msg.payload, function(err) {
                        //if (err) node.error(err);
                    //});
                //}
            //}
            //else {
                //if (typeof msg.topic !== 'string') node.error("msg.topic : the key is not defined");
            //}
        //});
    //}
    //else {
        //this.error("MySQL database not configured");
    //}
//}
//RED.nodes.registerType("mysql out",MysqlDBNodeOut);
