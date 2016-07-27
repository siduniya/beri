var Log = require('./log.js')
var Torrent = require('./torrent.js')
var Directory = require('./directory.js')
var config = require('../configs/config.json')
var FileTransfert = require('./filetransfert.js')

Torrent.Directory = Directory

var auth = require('http-auth')
var express = require('express')
var compression = require('compression')
var http = require('http')
var bodyParser = require('body-parser')
var Path = require('path')

http.globalAgent.maxSockets = Infinity

/**
 * Deserve http requests.
 * @constructor
*/
function Server () {
  this.app = express()
  if (config.server.htpasswd && config.server.htpasswd.length > 0) {
    this.basic = auth.basic({
      realm: config.server.message,
      file: config.server.htpasswd
    })
    this.app.use(auth.connect(this.basic))
  }
  this.app.use(compression())
  this.app.use(express.static(Path.join(__dirname, '/public')))
  this.app.use(bodyParser.json())
  this.app.use(bodyParser.urlencoded({
    extended: true
  }))

  this.server = http.createServer(this.app)
  var port = process.env.PORT || config.server.port
  this.server.listen(port, function () {
    Log.print('Server listening at port ' + port)
  })

  // Client Download file
  this.app.get('/files', function (req, res) {
    if (req.query.f) {
      req.query.f = req.query.f.split('..').join('')
      Log.print(req.user + ' download file: ' + req.query.f)
      Directory.setDownloading(req.query.f)
      var transfert = new FileTransfert(req, res, function () {
        Directory.finishDownloading(req.query.f)
      })
    } 
  })

  // client start torrent
  this.app.post('/download-t', function (req, res) {
    if (req.body.url) {
      Log.print(req.user + ' download torrent: ' + req.body.url)
      Torrent.setDownloader(req.user, req.body.url)
      Torrent.start(req.body.url)
      res.end()
    } else {
      res.end(JSON.stringify({
        err: 'Wrong url.'
      }))
    }
  })

  // client ask list of torrent active
  this.app.post('/list-t', function (req, res) {
    res.end(JSON.stringify(Torrent.getInfo()))
  })

  // client ask list of directory
  this.app.post('/list-d', function (req, res) {
    if (req.body.dir) {
      req.body.dir = req.body.dir.replace(/%20/g, ' ')
      res.end(JSON.stringify(Directory.list(req.body.dir)))
    } else {
      res.end(JSON.stringify({
        err: 'Undefined directory.'
      }))
    }
  })

  // client remove torrent
  this.app.post('/remove-t', function (req, res) {
    if (req.body.hash) {
      Log.print(req.user + ' remove torrent: ' + req.body.hash)
      Torrent.remove(req.body.hash)
      res.end(JSON.stringify({
        hash: req.body.hash
      }))
    } else {
      res.end(JSON.stringify({
        err: 'Wrong hash.'
      }))
    }
  })

  // client remove directory / file
  this.app.post('/remove-d', function (req, res) {
    if (req.body.file) {
      req.body.file = req.body.file.replace(/%20/g, ' ')
      if (Directory.remove(req.body.file) !== -1) {
        Log.print(req.user + ' remove file: ' + req.body.file)
        res.end(JSON.stringify({
          file: req.body.file.split('/')[req.body.file.split('/').length - 1]
        }))
      } else {
        res.end(JSON.stringify({
          err: 'Cannot remove, someone is downloading the file.'
        }))
      }
    } else {
      res.end(JSON.stringify({
        err: 'Wrong file.'
      }))
    }
  })

  // client rename file
  this.app.post('/rename-d', function (req, res) {
    if (req.body.path && req.body.oldname && req.body.newname) {
      req.body.path = req.body.path.replace(/%20/g, ' ')
      req.body.oldname = req.body.oldname.replace(/%20/g, ' ')
      req.body.newname = req.body.newname.replace(/%20/g, ' ')
      if (Directory.rename(req.body.path, req.body.oldname, req.body.newname) !== -1) {
        Log.print(req.user + ' rename file: ' + Path.join(req.body.path, req.body.oldname) + ' in: ' + req.body.newname)
        res.end(JSON.stringify({
          path: req.body.path,
          oldname: req.body.oldname,
          newname: req.body.newname
        }))
        Directory.setOwner(Path.join(req.body.path, req.body.newname), req.user)
      } else {
        res.end(JSON.stringify({
          err: 'Cannot rename, someone is downloading the file.'
        }))
      }
    } else {
      res.end(JSON.stringify({
        err: 'Wrong name.'
      }))
    }
  })

  // client create directory
  this.app.post('/mkdir-d', function (req, res) {
    if (req.body.path && req.body.name) {
      req.body.path = req.body.path.replace(/%20/g, ' ')
      req.body.name = req.body.name.replace(/%20/g, ' ')
      Log.print(req.user + ' create directory: ' + Path.join(req.body.path, req.body.name))
      Directory.mkdir(req.body.path, req.body.name)
      res.end(JSON.stringify({
        name: req.body.name
      }))
      Directory.setOwner(Path.join(req.body.path, req.body.name), req.user)
    } else {
      res.end(JSON.stringify({
        err: 'Wrong name.'
      }))
    }
  })

  // client move directory
  this.app.post('/mv-d', function (req, res) {
    if (req.body.path && req.body.file && req.body.folder) {
      req.body.path = req.body.path.replace(/%20/g, ' ')
      req.body.file = req.body.file.replace(/%20/g, ' ')
      req.body.folder = req.body.folder.replace(/%20/g, ' ')
      if (Directory.mv(req.body.path, req.body.file, req.body.folder) !== -1) {
        Log.print(req.user + ' move: ' + Path.join(req.body.path, req.body.file) + ' in: ' + Path.join(req.body.path, req.body.folder))
        res.end(JSON.stringify({
          file: req.body.file
        }))
        Directory.setOwner(Path.join(req.body.path, req.body.folder, req.body.file), req.user)
      } else {
        res.end(JSON.stringify({
          err: 'Cannot move, someone is downloading the file.'
        }))
      }
    } else {
      res.end(JSON.stringify({
        err: 'Wrong name.'
      }))
    }
  })

  // client search torrent
  this.app.post('/search-t', function (req, res) {
    var searchEngine = require('./searchT.js')
    if (req.body.query !== '') {
      req.body.query = req.body.query.replace(/%20/g, ' ')
      Log.print(req.user + ' search: ' + req.body.query)
      searchEngine.search(req.body.query, function (data) {
        res.end(JSON.stringify(data))
      })
    } else {
      searchEngine.latest(function (data) {
        res.end(JSON.stringify(data))
      })
    }
  })

  // client get meida info
  this.app.post('/info-d', function (req, res) {
    if (req.body.type && req.body.query) {
      req.body.type = req.body.type.replace(/%20/g, ' ')
      req.body.query = req.body.query.replace(/%20/g, ' ')
      var infoEngine = require('./mediaInfo.js')
      infoEngine.getInfo(req.body.type, req.body.query, function (data) {
        res.end(JSON.stringify(data))
      })
    } else {
      res.end()
    }
  })

  // lock api request
  this.app.get('/lock-d', function (req, res) {
    if (req.query.f) {
      req.query.f = req.query.f.replace(/%20/g, ' ')
      if (Directory.isDownloading(req.query.f)) {
        res.end(Directory.isDownloading(req.query.f).toString())
      } else {
        res.end('false')
      }
    } else {
      res.end()
    }
  })
}

module.exports = new Server()
