/*
Where the current Clontarf app assigns source paths:

storyVideo.src = source;
arViewer.src = item.model;

use:

storyVideo.src = window.Fionn ? Fionn.asset("video", source) : source;
arViewer.src = window.Fionn ? Fionn.asset("model", item.model) : item.model;

After rendering a stop:

const nextStop = stops[currentStopIndex + 1];
if (nextStop && window.Fionn) Fionn.prefetchStop(nextStop);
*/
