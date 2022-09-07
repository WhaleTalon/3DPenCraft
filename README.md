# 3DPenCraft

##  Introduction

Plastic 3D sculptures made with 3D Pens have come a long way since the devices first came on the market. 

Yet I found social media sites to be short on ideas for 3D artwork and renderings, with lots of repetition in the ideas that are available.

This was the inspiration for 3DPenCraft, a small application that renders 3D models as tubular extrusions. 

## Features & Constraints

- Supports the following 3D formats for source objects: OBJ, FBX and GLB. Also supports GLTF if not bundled with textures. By default the application renders a Torus Knot geometry. 

- The size of the artwork is fixed to 25 cm, and the thickness of the plastic extrusions to 1.2mm in diameter.

- The application is constrained to render extrusions in a single colour to minimize UI requirements. Though, the background and foreground colours are modifiable. See the included video for some interesting textured renderings.

- The most important feature is simulated 3D extrusions happen in real-time. 

- The real-time animation runs at 60 fps inside a browser, on a modest device. 

- The project is coded in javascript and uses the three.js library. It runs completely on the user’s device.

- Implements the state machine design pattern.

- Uses requestIdleCallback() method to implement a simple process queue to ensure the UI & animation loop remains responsive.

- Reduction of the polygon count of the source geometry is supported up to a maximum of 95% vertex reduction.

- Finding the extrusion path is cast as a Travelling Salesman Problem, and solved using the Nearest Neighbour algorithm.

##  Live Demo

A live demo is available at: 
https://jsfiddle.net/mornejac/2bsqfun7/1/

## Video Overview

The following youtube video is an overview of the design and implemention of the application. 
https://youtu.be/_FKDQh5-SoY
