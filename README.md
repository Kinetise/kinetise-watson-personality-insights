# Watson Personality Insights App

This app is intended to showcase powerful integration capabilities between [Bluemix platform](https://bluemix.net) and [Kinetise](https://kinetise.com). 

![Watson Personality Insights App](http://assets.kinetise.com/kinetise_pi.gif "Bluemix Kinetise Personality Insights App")

## Architecture

This repository contains a backend part of Watson Personality Insights App. It is build on top of Node.js SDK and integrates with following services:

* [Personality Insights](http://www.ibm.com/smarterplanet/us/en/ibmwatson/developercloud/personality-insights.html),
* [Cloudant NoSQL DB](https://cloudant.com/getting-started-with-cloudant-ibm-bluemix/).

The backend part is used by mobile application built in Kinetise and is connecting to IBM Watson to use Personality Insights service.

![Architecture](http://assets.kinetise.com/kinetise_pi_arch.png "Architecture")

## Basic Concept

The service publishes three endpoints:

* `POST setContent` fetches content from mobile app, invokes Personality Insights service to analyze it and stores results in Cloudant NoSQL DB.
* `GET getDescription` serves analyzed content as JSON feed to be displayed by mobile app. 
* `GET getGraph/:watsonId` exposes HTML page with feature distribution graph.

# Deploy to Bluemix

You can deploy this code to Bluemix using button below:

[![Deploy to Bluemix](https://bluemix.net/deploy/button.png)](https://bluemix.net/deploy?repository=https://github.com/Kinetise/kinetise-bluemix-insights)

Once finished, click "View Your App" to continue.