#!/bin/bash

mkdir packaging
cp -r ../node_modules ./packaging
cp ../package.json ./packaging
cp ../index.js ./packaging
cd packaging
zip -r -D OPMStatusSkill.zip *
mv OPMStatusSkill.zip ../
cd ..

rm -rf packaging
 
