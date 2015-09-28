var bodyParser = require('body-parser')
    cfenv = require('cfenv')
    express = require('express')
    fs = require('fs')
    sqlite3 = require('sqlite3').verbose()
    swig = require('swig')
    watson = require('watson-developer-cloud')

// ------------------
// App configuration
// ------------------
var app = express();
app.use(bodyParser.json())
app.use(express.static(__dirname + '/public'));

// ------
// Watson
// ------
var insights = watson.personality_insights({
    version: 'v2'
})

// ------------------------
// Database initialization
// ------------------------
var db = new sqlite3.Database('kinetise.db')
var query = 'SELECT name FROM sqlite_master WHERE type="table" AND name="sessions"'
var create = 'CREATE TABLE "sessions" (' +
             '"id" INTEGER PRIMARY KEY AUTOINCREMENT, ' +
             '"sessionId" VARCHAR(128), ' +
             '"content" TEXT, ' +
             '"created" DATETIME, ' +
             '"response" TEXT)'

db.get(query, function (err, rows) {
    if (rows === undefined) {
        db.run(create, function (err) {
            if (err !== null) {
                console.log('Failed to create database: ' + err)
            }
        })
    }
})

// -----------------------------------------
// setContent: receive text from mobile app
// -----------------------------------------
app.post('/setContent', function (req, res) {
    checkSetContentRequestValidity(req, function (isValid, errorMessage) {
        if (!isValid) {
            sendPostError(res, errorMessage)
        }
        else {
            processContentUnchecked(req, function (err) {
                if (err) {
                    sendPostError(res, 'Could not fetch Personality Insights')
                }
                else {
                    sendPostSuccess(res)
                }
            })
        }
    })
})

function sendPostError(res, message) {
    var statusCode = 400
    var context = {
        message: message
    }

    sendPostResponse(res, context, statusCode)
}

function sendPostResponse(res, context, statusCode) {
    var template = swig.compileFile('templates/response.xml')

    res.set('Content-Type', 'text/xml')
    res.status(statusCode).send(template(context))
}

function sendPostSuccess(res) {
    var statusCode = 200
    var context = {
        message: ''
    }

    sendPostResponse(res, context, statusCode)
}

function checkSetContentRequestValidity(req, handler) {
    if (isSessionIDGiven(req)) {
        if (isContentGiven(req)) {
            handler(true, undefined)
        }
        else {
            handler(false, 'Invalid content!')
        }
    }
    else {
        handler(false, 'Invalid session ID!')
    }
}

function isSessionIDGiven(req) {
    return getSessionIDUnchecked(req) !== undefined
}

function getSessionIDUnchecked(req) {
    return req.query.sessionId
}

function isContentGiven(req) {
    var items = req.body['items']

    if (items && Array.isArray(items)) {
        var firstItem = items[0]

        return (firstItem['form'] &&
                firstItem['form']['content'])
    }
}

function getContentUnchecked(req) {
    return req.body['items'][0]['form']['content']
}

function processContentUnchecked(req, handler) {
    var content = getContentUnchecked(req)
        sessionID = getSessionIDUnchecked(req)
        insightsConfig = {
            text: content,
            language: 'en'
        }

    insights.profile(insightsConfig, function (err, response) {
        if (err) {
            console.log('Personality insights fetch failed: ', err)
            handler(err)
        }
        else {
            responseString = JSON.stringify(response)
            updateDatabaseContent(content, sessionID, responseString, function (err) {
                handler(err)
            })
        }
    })
}

function updateDatabaseContent(content, sessionID, response, handler) {
    var insert = 'INSERT INTO sessions (sessionID, content, response, created) VALUES (?, ?, ?, datetime("now"))'

    db.run(insert, [sessionID, content, response], function (err) {
        if (err !== null) {
            console.log('Failed to insert content: ' + err)
        }

        handler(err)
    })
}

// ------------------------------------------------
// getDescription: returns personality description
// ------------------------------------------------
app.get('/getDescription', function (req, res) {
    var template = swig.compileFile('templates/personality_description.xml')
    getLatestInsightsJSON(req, function(insights) {
        if (insights) {
            var items = parseDescriptionFromWatsonResponse(req, insights)
            sendDescriptionSuccess(res, items)
        }
        else {
            sendPostError(res, 'No content defined for this session')
        }
    })
})

function sendDescriptionSuccess(res, items) {
    var context = {
        items: items
    }

    var template = swig.compileFile('templates/personality_description.xml')
    res.set('Content-Type', 'text/xml')
    res.status(200).send(template(context))
}

function parseDescriptionFromWatsonResponse(req, response) {
    var sessionID = getSessionIDUnchecked(req)
    var tree = response['tree']['children']
    var items = parseChildren(tree, 0)

    items.forEach(function (item) {
        if (item.graphURL) {
            item.graphURL += '/?sessionId=' + sessionID
        }
    })

    return items
}

function parseChildren(root, nestLevel) {
    var allChildren = []

    if (root && Array.isArray(root)) {
        for (var i = 0; i < root.length; ++i) {
            var childJSON = root[i]
            var child = createChildFromJSON(childJSON, nestLevel)
            allChildren.push(child)

            var childRoot = childJSON['children']
            var children = parseChildren(childRoot, nestLevel + 1)
            allChildren = allChildren.concat(children)
        }
    }

    return allChildren
}

function createChildFromJSON(json, nestLevel) {
    var child = {
        id: json['id'],
        name: json['name'],
        value: formatPercentage(json['percentage']),
        type: (nestLevel + 1).toString(),
        hasChildren: (json['children'] !== undefined) + ''
    }

    if (idsWithGraphs.indexOf(child.id) > -1) {
        child.graphURL = appEnv.url + '/getGraph/' + child.id
    }

    return child
}

function formatPercentage(percentage) {
    if (percentage) {
        return (percentage * 100).toFixed(2) + '%'
    }
}

var idsWithGraphs = ['personality', 'Openness', 'Conscientiousness', 'Extraversion',
                     'Agreeableness', 'Neuroticism', 'needs', 'values']

function getLatestInsightsJSON(req, handler) {
    getLatestResponse(req, function(response) {
        if (response) {
            handler(JSON.parse(response))
        }
        else {
            handler(response)
        }
    })
}

function getLatestResponse(req, handler) {
    var sessionID = getSessionIDUnchecked(req)
        select = 'SELECT * FROM sessions WHERE sessionId = ? ' +
                 'ORDER BY datetime(created) DESC LIMIT 1'
        response = undefined

    db.get(select, [sessionID], function (err, row) {
        if (err) {
            console.log('Content fetching error: ', err)
        }
        else if (row) {
            response = row['response']
        }
        else {
            console.log('No entry for sessionID: ' + sessionID)
        }

        handler(response)
    })
}

// -------------------------------------------
// getGraph: returns URL to personality chart
// -------------------------------------------
app.get('/getGraph/:watsonId', function(req, res) {
    var template = swig.compileFile('templates/chart.html')

    getLatestInsightsJSON(req, function(insights) {
        if (insights) {
            var root = insights['tree']['children']
            var child = getChildWithId(req.params.watsonId, root)

            if (child) {
                var rendered = template({
                    data: JSON.stringify(createChartData(child)),
                    options: JSON.stringify(createChartOptions())
                })

                res.send(rendered)
                return
            }
        }

        res.status(404).send('404 - Page not found')
    })
})

function getChildWithId(id, root) {
    if (root && Array.isArray(root)) {
        for (var i = 0; i < root.length; ++i) {
            var child = root[i]

            if (child['id'] === id) {
                if (child['children'] && child['children'].length === 1) {
                    return child['children'][0]
                }
                else {
                    return child
                }
            }

            child = getChildWithId(id, child['children'])

            if (child) {
                return child
            }
        }
    }
}

var colors = ['#4178BD', '#9854D4', '#01B4A0', '#D74009', '#323232', '#EDC01C']
var highlights = ['#5596E6', '#AF6EE8', '#41D6C3', '#FF5006', '#555555', '#FAE249']

function createChartData(rootJSON) {
    var children = rootJSON['children']
    var data = []

    for (var i = 0; i < children.length; ++i) {
        var child = children[i]
        var value = (child['percentage'] * 100).toFixed(2)

        data.push({
            value: value,
            color: colors[i % colors.length],
            highlight: highlights[i % highlights.length],
            label: child['name']
        })
    }

    return data
}

function createChartOptions() {
    return {
        scaleShowLabelBackdrop : true,
        scaleBackdropColor : "rgba(255,255,255,0.75)",
        scaleBeginAtZero : true,
        scaleBackdropPaddingY : 2,
        scaleBackdropPaddingX : 2,
        scaleShowLine : true,
        segmentShowStroke : true,
        segmentStrokeColor : "#fff",
        segmentStrokeWidth : 2,
        animationSteps : 100,
        animationEasing : "easeOutBounce",
        animateRotate : true,
        animateScale : false,
        legendTemplate : "<ul class=\"<%=name.toLowerCase()%>-legend\"><% for (var i=0; i<segments.length; i++){%><li><span style=\"background-color:<%=segments[i].fillColor%>\"></span><%if(segments[i].label){%><%=segments[i].label%><%}%></li><%}%></ul>"
    }
}

var appEnv = cfenv.getAppEnv()

app.listen(appEnv.port, function() {
  console.log("server starting on " + appEnv.url)
})
