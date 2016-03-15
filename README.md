# Bluemix Kinetise Personality Insights App

This app is intended to showcase powerful integration capabilities between [Bluemix platform](https://bluemix.net) and [Kinetise](https://kinetise.com). 

![Bluemix Kinetise Personality Insights App](https://raw.githubusercontent.com/turekj/kinetise-bluemix-insights/master/docs/img/kinetise_pi.gif "Bluemix Kinetise Personality Insights App")

## Architecture

This repository contains a backend part of Bluemix Kinetise Personality Insights App. It is build on top of Node.js SDK and integrates with following services:

* [Personality Insights](http://www.ibm.com/smarterplanet/us/en/ibmwatson/developercloud/personality-insights.html),
* [Cloudant NoSQL DB](https://cloudant.com/getting-started-with-cloudant-ibm-bluemix/).

## Basic Concept

The service publishes three endpoints:

* `POST setContent` fetches content from Kinetise App, invokes Personality Insights service to analyze it and stores results in Cloudant NoSQL DB.
* `GET getDescription` serves analyzed content as Kinetise JSON feed. 
* `GET getGraph/:watsonId` exposes HTML page with feature distribution graph.

# Deploy to Bluemix

You can deploy this code to Bluemix using button below:

[![Deploy to Bluemix](https://bluemix.net/deploy/button.png)](https://bluemix.net/deploy?repository=https://github.com/turekj/kinetise-bluemix-insights)
