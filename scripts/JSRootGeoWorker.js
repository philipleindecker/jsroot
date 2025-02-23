JSROOT = {}; // just place holder for JSROOT.GEO functions

JSROOT.BIT = function(n) { return 1 << (n); }

importScripts("three.min.js", "ThreeCSG.js", "JSRootGeoBase.js");

// if (console) console.log('geoworker started ' + THREE.REVISION);

var clones = null;

onmessage = function(e) {

   if (typeof e.data == 'string') {
      console.log('Worker get message ' + e.data);
      return;
   }

   if (typeof e.data != 'object') return;

   e.data.tm1 = new Date().getTime();

   if (e.data.init) {
      // console.log('start worker ' +  (e.data.tm1 -  e.data.tm0));

      var nodes = e.data.clones;
      if (nodes) {
         // console.log('get clones ' + nodes.length);
         clones = new JSROOT.GEO.ClonedNodes(null, nodes);
         delete e.data.clones;
         clones.sortmap = e.data.sortmap;
      }

      // used in composite shape
      JSROOT.browser = e.data.browser;

      e.data.tm2 = new Date().getTime();

      return postMessage(e.data);
   }

   if (e.data.shapes) {
      // this is task to create geometries in the worker

      var shapes = e.data.shapes, transferables = [];

      // build all shapes up to specified limit, also limit execution time
      for (var n=0;n<100;++n) {
         var res = clones.BuildShapes(shapes, e.data.limit, 1000);
         if (res.done) break;
         postMessage({ progress: "Worker creating: " + res.shapes + " / " + shapes.length + " shapes,  "  + res.faces + " faces" });
      }

      for (var n=0;n<shapes.length;++n) {
         var item = shapes[n];

         if (item.geom) {
            var bufgeom;
            if (item.geom instanceof THREE.BufferGeometry) {
               bufgeom = item.geom;
            } else {
               var bufgeom = new THREE.BufferGeometry();
               bufgeom.fromGeometry(item.geom);
            }

            item.buf_pos = bufgeom.attributes.position.array;
            item.buf_norm = bufgeom.attributes.normal.array;

            // use nice feature of HTML workers with transferable
            // we allow to take ownership of buffer from local array
            // therefore buffer content not need to be copied
            transferables.push(item.buf_pos.buffer, item.buf_norm.buffer);

            delete item.geom;
         }

         delete item.shape; // no need to send back shape
      }

      e.data.tm2 = new Date().getTime();

      return postMessage(e.data, transferables);
   }

   if (e.data.collect !== undefined) {
      // this is task to collect visible nodes using camera position

      // first mark all visible flags
      clones.MarkVisibles(false, false, e.data.visible);
      delete e.data.visible;

      var matrix = null;
      if (e.data.matrix)
         matrix = new THREE.Matrix4().fromArray(e.data.matrix);
      delete e.data.matrix;

      var res = clones.CollectVisibles(e.data.collect, JSROOT.GEO.CreateFrustum(matrix), e.data.collect_nodes);

      e.data.new_nodes = res.lst;
      e.data.complete = res.complete; // inform if all nodes are selected

      e.data.tm2 = new Date().getTime();

      // console.log('Collect visibles in worker ' + e.data.new_nodes.length + ' takes ' + (e.data.tm2-e.data.tm1));

      return postMessage(e.data);
   }

}
