// \ProvidesPackage{apa7}
// \ProvidesPackage{simplekv}

  var Module = typeof BusytexPipeline !== 'undefined' ? BusytexPipeline : {};

  if (!Module.expectedDataFileDownloads) {
    Module.expectedDataFileDownloads = 0;
  }

  Module.expectedDataFileDownloads++;
  (function() {
    // Do not attempt to redownload the virtual filesystem data when in a pthread or a Wasm Worker context.
    if (Module['ENVIRONMENT_IS_PTHREAD'] || Module['$ww']) return;
    var loadPackage = function(metadata) {

      var PACKAGE_PATH = '';
      if (typeof window === 'object') {
        PACKAGE_PATH = window['encodeURIComponent'](window.location.pathname.toString().substring(0, window.location.pathname.toString().lastIndexOf('/')) + '/');
      } else if (typeof process === 'undefined' && typeof location !== 'undefined') {
        // web worker
        PACKAGE_PATH = encodeURIComponent(location.pathname.toString().substring(0, location.pathname.toString().lastIndexOf('/')) + '/');
      }
      var PACKAGE_NAME = 'build/wasm/texlive-revistas.data';
      var REMOTE_PACKAGE_BASE = 'texlive-revistas.data';
      if (typeof Module['locateFilePackage'] === 'function' && !Module['locateFile']) {
        Module['locateFile'] = Module['locateFilePackage'];
        err('warning: you defined Module.locateFilePackage, that has been renamed to Module.locateFile (using your locateFilePackage for now)');
      }
      var REMOTE_PACKAGE_NAME = Module['locateFile'] ? Module['locateFile'](REMOTE_PACKAGE_BASE, '') : REMOTE_PACKAGE_BASE;
var REMOTE_PACKAGE_SIZE = metadata['remote_package_size'];

      function fetchRemotePackage(packageName, packageSize, callback, errback) {
        if (typeof process === 'object' && typeof process.versions === 'object' && typeof process.versions.node === 'string') {
          require('fs').readFile(packageName, function(err, contents) {
            if (err) {
              errback(err);
            } else {
              callback(contents.buffer);
            }
          });
          return;
        }
        var xhr = new XMLHttpRequest();
        xhr.open('GET', packageName, true);
        xhr.responseType = 'arraybuffer';
        xhr.onprogress = function(event) {
          var url = packageName;
          var size = packageSize;
          if (event.total) size = event.total;
          if (event.loaded) {
            if (!xhr.addedTotal) {
              xhr.addedTotal = true;
              if (!Module.dataFileDownloads) Module.dataFileDownloads = {};
              Module.dataFileDownloads[url] = {
                loaded: event.loaded,
                total: size
              };
            } else {
              Module.dataFileDownloads[url].loaded = event.loaded;
            }
            var total = 0;
            var loaded = 0;
            var num = 0;
            for (var download in Module.dataFileDownloads) {
            var data = Module.dataFileDownloads[download];
              total += data.total;
              loaded += data.loaded;
              num++;
            }
            total = Math.ceil(total * Module.expectedDataFileDownloads/num);
            if (Module['setStatus']) Module['setStatus'](`Downloading data... (${loaded}/${total})`);
          } else if (!Module.dataFileDownloads) {
            if (Module['setStatus']) Module['setStatus']('Downloading data...');
          }
        };
        xhr.onerror = function(event) {
          throw new Error("NetworkError for: " + packageName);
        }
        xhr.onload = function(event) {
          if (xhr.status == 200 || xhr.status == 304 || xhr.status == 206 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
            var packageData = xhr.response;
            callback(packageData);
          } else {
            throw new Error(xhr.statusText + " : " + xhr.responseURL);
          }
        };
        xhr.send(null);
      };

      function handleError(error) {
        console.error('package error:', error);
      };

    function runWithFS() {

      function assert(check, msg) {
        if (!check) throw msg + new Error().stack;
      }
Module['FS_createPath']("/", "texmf", true, true);
    Module['FS_createPath']("/texmf", "texmf-dist", true, true);
    Module['FS_createPath']("/texmf/texmf-dist", "bibtex", true, true);
    Module['FS_createPath']("/texmf/texmf-dist", "tex", true, true);
    Module['FS_createPath']("/texmf/texmf-dist/bibtex", "bib", true, true);
    Module['FS_createPath']("/texmf/texmf-dist/bibtex", "bst", true, true);
    Module['FS_createPath']("/texmf/texmf-dist/tex", "generic", true, true);
    Module['FS_createPath']("/texmf/texmf-dist/tex", "latex", true, true);
    Module['FS_createPath']("/texmf/texmf-dist/bibtex/bib", "biblatex", true, true);
    Module['FS_createPath']("/texmf/texmf-dist/bibtex/bst", "biblatex", true, true);
    Module['FS_createPath']("/texmf/texmf-dist/tex/generic", "kastrup", true, true);
    Module['FS_createPath']("/texmf/texmf-dist/tex/generic", "simplekv", true, true);
    Module['FS_createPath']("/texmf/texmf-dist/tex/latex", "apa7", true, true);
    Module['FS_createPath']("/texmf/texmf-dist/tex/latex", "biblatex-apa", true, true);
    Module['FS_createPath']("/texmf/texmf-dist/bibtex/bib/biblatex", "biblatex", true, true);
    Module['FS_createPath']("/texmf/texmf-dist/tex/latex/apa7", "config", true, true);

        var PACKAGE_UUID = metadata['package_uuid'];
        var indexedDB;
        if (typeof window === 'object') {
          indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
        } else if (typeof location !== 'undefined') {
          // worker
          indexedDB = self.indexedDB;
        } else {
          throw 'using IndexedDB to cache data can only be done on a web page or in a web worker';
        }
        var IDB_RO = "readonly";
        var IDB_RW = "readwrite";
        var DB_NAME = "EM_PRELOAD_CACHE";
        var DB_VERSION = 1;
        var METADATA_STORE_NAME = 'METADATA';
        var PACKAGE_STORE_NAME = 'PACKAGES';
        function openDatabase(callback, errback) {
          try {
            var openRequest = indexedDB.open(DB_NAME, DB_VERSION);
          } catch (e) {
            return errback(e);
          }
          openRequest.onupgradeneeded = function(event) {
            var db = /** @type {IDBDatabase} */ (event.target.result);

            if (db.objectStoreNames.contains(PACKAGE_STORE_NAME)) {
              db.deleteObjectStore(PACKAGE_STORE_NAME);
            }
            var packages = db.createObjectStore(PACKAGE_STORE_NAME);

            if (db.objectStoreNames.contains(METADATA_STORE_NAME)) {
              db.deleteObjectStore(METADATA_STORE_NAME);
            }
            var metadata = db.createObjectStore(METADATA_STORE_NAME);
          };
          openRequest.onsuccess = function(event) {
            var db = /** @type {IDBDatabase} */ (event.target.result);
            callback(db);
          };
          openRequest.onerror = function(error) {
            errback(error);
          };
        };

        // This is needed as chromium has a limit on per-entry files in IndexedDB
        // https://cs.chromium.org/chromium/src/content/renderer/indexed_db/webidbdatabase_impl.cc?type=cs&sq=package:chromium&g=0&l=177
        // https://cs.chromium.org/chromium/src/out/Debug/gen/third_party/blink/public/mojom/indexeddb/indexeddb.mojom.h?type=cs&sq=package:chromium&g=0&l=60
        // We set the chunk size to 64MB to stay well-below the limit
        var CHUNK_SIZE = 64 * 1024 * 1024;

        function cacheRemotePackage(
          db,
          packageName,
          packageData,
          packageMeta,
          callback,
          errback
        ) {
          var transactionPackages = db.transaction([PACKAGE_STORE_NAME], IDB_RW);
          var packages = transactionPackages.objectStore(PACKAGE_STORE_NAME);
          var chunkSliceStart = 0;
          var nextChunkSliceStart = 0;
          var chunkCount = Math.ceil(packageData.byteLength / CHUNK_SIZE);
          var finishedChunks = 0;
          for (var chunkId = 0; chunkId < chunkCount; chunkId++) {
            nextChunkSliceStart += CHUNK_SIZE;
            var putPackageRequest = packages.put(
              packageData.slice(chunkSliceStart, nextChunkSliceStart),
              `package/${packageName}/${chunkId}`
            );
            chunkSliceStart = nextChunkSliceStart;
            putPackageRequest.onsuccess = function(event) {
              finishedChunks++;
              if (finishedChunks == chunkCount) {
                var transaction_metadata = db.transaction(
                  [METADATA_STORE_NAME],
                  IDB_RW
                );
                var metadata = transaction_metadata.objectStore(METADATA_STORE_NAME);
                var putMetadataRequest = metadata.put(
                  {
                    'uuid': packageMeta.uuid,
                    'chunkCount': chunkCount
                  },
                  `metadata/${packageName}`
                );
                putMetadataRequest.onsuccess = function(event) {
                  callback(packageData);
                };
                putMetadataRequest.onerror = function(error) {
                  errback(error);
                };
              }
            };
            putPackageRequest.onerror = function(error) {
              errback(error);
            };
          }
        }

        /* Check if there's a cached package, and if so whether it's the latest available */
        function checkCachedPackage(db, packageName, callback, errback) {
          var transaction = db.transaction([METADATA_STORE_NAME], IDB_RO);
          var metadata = transaction.objectStore(METADATA_STORE_NAME);
          var getRequest = metadata.get(`metadata/${packageName}`);
          getRequest.onsuccess = function(event) {
            var result = event.target.result;
            if (!result) {
              return callback(false, null);
            } else {
              return callback(PACKAGE_UUID === result['uuid'], result);
            }
          };
          getRequest.onerror = function(error) {
            errback(error);
          };
        }

        function fetchCachedPackage(db, packageName, metadata, callback, errback) {
          var transaction = db.transaction([PACKAGE_STORE_NAME], IDB_RO);
          var packages = transaction.objectStore(PACKAGE_STORE_NAME);

          var chunksDone = 0;
          var totalSize = 0;
          var chunkCount = metadata['chunkCount'];
          var chunks = new Array(chunkCount);

          for (var chunkId = 0; chunkId < chunkCount; chunkId++) {
            var getRequest = packages.get(`package/${packageName}/${chunkId}`);
            getRequest.onsuccess = function(event) {
              // If there's only 1 chunk, there's nothing to concatenate it with so we can just return it now
              if (chunkCount == 1) {
                callback(event.target.result);
              } else {
                chunksDone++;
                totalSize += event.target.result.byteLength;
                chunks.push(event.target.result);
                if (chunksDone == chunkCount) {
                  if (chunksDone == 1) {
                    callback(event.target.result);
                  } else {
                    var tempTyped = new Uint8Array(totalSize);
                    var byteOffset = 0;
                    for (var chunkId in chunks) {
                      var buffer = chunks[chunkId];
                      tempTyped.set(new Uint8Array(buffer), byteOffset);
                      byteOffset += buffer.byteLength;
                      buffer = undefined;
                    }
                    chunks = undefined;
                    callback(tempTyped.buffer);
                    tempTyped = undefined;
                  }
                }
              }
            };
            getRequest.onerror = function(error) {
              errback(error);
            };
          }
        }

      function processPackageData(arrayBuffer) {
        assert(arrayBuffer, 'Loading data file failed.');
        assert(arrayBuffer.constructor.name === ArrayBuffer.name, 'bad input to processPackageData');
        var byteArray = new Uint8Array(arrayBuffer);
        var curr;
        var compressedData = {"data":null,"cachedOffset":741909,"cachedIndexes":[-1,-1],"cachedChunks":[null,null],"offsets":[0,2048,4096,6144,8192,10240,12288,14336,16384,18432,20480,22528,24576,26624,28672,30720,32768,34816,36864,38912,40960,43008,45056,47104,49152,51200,53248,55296,57344,59392,61440,63488,65536,67584,69632,71680,73728,75776,77824,79872,81920,83968,86016,88064,90112,92160,94208,96256,98304,100352,102400,104448,106496,108544,110592,112640,114688,116736,118784,120832,122880,124928,126976,129024,131072,133120,135168,137216,139264,141312,143360,145408,147456,149504,151552,153600,155648,157696,159744,161792,163840,165888,167936,169984,172032,174080,176128,178176,180224,182272,184320,186368,188416,190464,192512,194560,196608,198656,200704,202752,204800,206848,208896,210944,212992,215040,217088,219136,221184,223232,225280,227328,229376,231424,233472,235520,237568,239616,241664,243712,245760,247808,249856,251904,253952,256000,258048,260096,262144,264192,266240,268288,270336,272384,274432,276480,278528,280576,282624,284672,286720,288768,290816,292864,294912,296960,299008,301056,303104,305152,307200,309248,311296,313344,315392,317440,319488,321536,323584,325632,327680,329728,331776,333824,335872,337920,339968,342016,344064,346112,348160,350208,352256,354304,356352,358400,360448,362496,364544,366592,368640,370688,372736,374784,376832,378880,380928,382976,385024,387072,389120,391168,393216,395264,397312,399360,401408,403456,405504,407552,409600,411648,413696,415744,417792,419840,421888,423936,425984,428032,430080,432128,434176,436224,438272,440320,442368,444416,446464,448512,450560,452608,454656,456704,458752,460800,462848,464896,466944,468992,471040,473088,475136,477184,479232,481280,483328,485376,487424,489472,491520,493568,495616,497664,499712,501760,503808,505856,507904,509952,512000,514048,516096,518144,520192,522240,524288,526336,528384,530432,532480,534528,536576,538624,540672,542720,544768,546816,548864,550912,552960,555008,557056,559104,561152,563200,565248,567296,569344,571392,573440,575488,577536,579584,581632,583680,585728,587776,589824,591872,593920,595968,598016,600064,602112,604160,606208,608256,610304,612352,614400,616448,618496,620544,622592,624640,626688,628736,630784,632832,634880,636928,638976,641024,643072,645120,647168,649216,651264,653312,655360,657408,659456,661504,663552,665600,667648,669696,671744,673792,675840,677888,679936,681984,684032,686080,688128,690176,692224,694272,696320,698368,700416,702464,704512,706560,708608,710656,712704,714752,716800,718848,720896,722944,724992,727040,729088,731136,733184,735232,737280,739328,741376],"sizes":[2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,533],"successes":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]}
;
            compressedData['data'] = byteArray;
            assert(typeof Module['LZ4'] === 'object', 'LZ4 not present - was your app build with -sLZ4?');
            Module['LZ4'].loadPackage({ 'metadata': metadata, 'compressedData': compressedData }, false);
            Module['removeRunDependency']('datafile_build/wasm/texlive-revistas.data');
      };
      Module['addRunDependency']('datafile_build/wasm/texlive-revistas.data');

      if (!Module.preloadResults) Module.preloadResults = {};

        function preloadFallback(error) {
          console.error(error);
          console.error('falling back to default preload behavior');
          fetchRemotePackage(REMOTE_PACKAGE_NAME, REMOTE_PACKAGE_SIZE, processPackageData, handleError);
        };

        openDatabase(
          function(db) {
            checkCachedPackage(db, PACKAGE_PATH + PACKAGE_NAME,
              function(useCached, metadata) {
                Module.preloadResults[PACKAGE_NAME] = {fromCache: useCached};
                if (useCached) {
                  fetchCachedPackage(db, PACKAGE_PATH + PACKAGE_NAME, metadata, processPackageData, preloadFallback);
                } else {
                  fetchRemotePackage(REMOTE_PACKAGE_NAME, REMOTE_PACKAGE_SIZE,
                    function(packageData) {
                      cacheRemotePackage(db, PACKAGE_PATH + PACKAGE_NAME, packageData, {uuid:PACKAGE_UUID}, processPackageData,
                        function(error) {
                          console.error(error);
                          processPackageData(packageData);
                        });
                    }
                  , preloadFallback);
                }
              }
            , preloadFallback);
          }
        , preloadFallback);

        if (Module['setStatus']) Module['setStatus']('Downloading...');

    }
    if (Module['calledRun']) {
      runWithFS();
    } else {
      if (!Module['preRun']) Module['preRun'] = [];
      Module["preRun"].push(runWithFS); // FS is not initialized yet, wait for it
    }

    }
    loadPackage({"files":[{"filename":"/texmf/texmf-dist/bibtex/bib/biblatex/biblatex/biblatex-examples.bib","start":0,"end":68013},{"filename":"/texmf/texmf-dist/bibtex/bst/biblatex/biblatex.bst","start":68013,"end":133523},{"filename":"/texmf/texmf-dist/tex/generic/kastrup/binhex.tex","start":133523,"end":136076},{"filename":"/texmf/texmf-dist/tex/generic/simplekv/simplekv.sty","start":136076,"end":136237},{"filename":"/texmf/texmf-dist/tex/generic/simplekv/simplekv.tex","start":136237,"end":148892},{"filename":"/texmf/texmf-dist/tex/latex/apa7/apa7.cls","start":148892,"end":209866},{"filename":"/texmf/texmf-dist/tex/latex/apa7/config/APA7american.txt","start":209866,"end":213137},{"filename":"/texmf/texmf-dist/tex/latex/apa7/config/APA7british.txt","start":213137,"end":216403},{"filename":"/texmf/texmf-dist/tex/latex/apa7/config/APA7czech.txt","start":216403,"end":219706},{"filename":"/texmf/texmf-dist/tex/latex/apa7/config/APA7dutch.txt","start":219706,"end":223000},{"filename":"/texmf/texmf-dist/tex/latex/apa7/config/APA7endfloat.cfg","start":223000,"end":226822},{"filename":"/texmf/texmf-dist/tex/latex/apa7/config/APA7english.txt","start":226822,"end":230093},{"filename":"/texmf/texmf-dist/tex/latex/apa7/config/APA7french.txt","start":230093,"end":233440},{"filename":"/texmf/texmf-dist/tex/latex/apa7/config/APA7german.txt","start":233440,"end":236756},{"filename":"/texmf/texmf-dist/tex/latex/apa7/config/APA7greek.txt","start":236756,"end":240126},{"filename":"/texmf/texmf-dist/tex/latex/apa7/config/APA7hungarian.txt","start":240126,"end":243484},{"filename":"/texmf/texmf-dist/tex/latex/apa7/config/APA7ngerman.txt","start":243484,"end":246810},{"filename":"/texmf/texmf-dist/tex/latex/apa7/config/APA7spanish.txt","start":246810,"end":250079},{"filename":"/texmf/texmf-dist/tex/latex/apa7/config/APA7turkish.txt","start":250079,"end":253387},{"filename":"/texmf/texmf-dist/tex/latex/biblatex-apa/american-apa.lbx","start":253387,"end":268987},{"filename":"/texmf/texmf-dist/tex/latex/biblatex-apa/apa.bbx","start":268987,"end":339167},{"filename":"/texmf/texmf-dist/tex/latex/biblatex-apa/apa.cbx","start":339167,"end":360254},{"filename":"/texmf/texmf-dist/tex/latex/biblatex-apa/apa.dbx","start":360254,"end":362930},{"filename":"/texmf/texmf-dist/tex/latex/biblatex-apa/apa.lua","start":362930,"end":364382},{"filename":"/texmf/texmf-dist/tex/latex/biblatex-apa/austrian-apa.lbx","start":364382,"end":381030},{"filename":"/texmf/texmf-dist/tex/latex/biblatex-apa/brazilian-apa.lbx","start":381030,"end":391327},{"filename":"/texmf/texmf-dist/tex/latex/biblatex-apa/british-apa.lbx","start":391327,"end":401398},{"filename":"/texmf/texmf-dist/tex/latex/biblatex-apa/catalan-apa.lbx","start":401398,"end":413339},{"filename":"/texmf/texmf-dist/tex/latex/biblatex-apa/czech-apa.lbx","start":413339,"end":428737},{"filename":"/texmf/texmf-dist/tex/latex/biblatex-apa/danish-apa.lbx","start":428737,"end":439843},{"filename":"/texmf/texmf-dist/tex/latex/biblatex-apa/dutch-apa.lbx","start":439843,"end":452376},{"filename":"/texmf/texmf-dist/tex/latex/biblatex-apa/english-apa.lbx","start":452376,"end":462573},{"filename":"/texmf/texmf-dist/tex/latex/biblatex-apa/estonian-apa.lbx","start":462573,"end":480496},{"filename":"/texmf/texmf-dist/tex/latex/biblatex-apa/finnish-apa.lbx","start":480496,"end":491235},{"filename":"/texmf/texmf-dist/tex/latex/biblatex-apa/french-apa.lbx","start":491235,"end":501821},{"filename":"/texmf/texmf-dist/tex/latex/biblatex-apa/galician-apa.lbx","start":501821,"end":513042},{"filename":"/texmf/texmf-dist/tex/latex/biblatex-apa/german-apa.lbx","start":513042,"end":531059},{"filename":"/texmf/texmf-dist/tex/latex/biblatex-apa/greek-apa.lbx","start":531059,"end":542583},{"filename":"/texmf/texmf-dist/tex/latex/biblatex-apa/hungarian-apa.lbx","start":542583,"end":553326},{"filename":"/texmf/texmf-dist/tex/latex/biblatex-apa/italian-apa.lbx","start":553326,"end":563879},{"filename":"/texmf/texmf-dist/tex/latex/biblatex-apa/naustrian-apa.lbx","start":563879,"end":580529},{"filename":"/texmf/texmf-dist/tex/latex/biblatex-apa/ngerman-apa.lbx","start":580529,"end":598292},{"filename":"/texmf/texmf-dist/tex/latex/biblatex-apa/norsk-apa.lbx","start":598292,"end":605959},{"filename":"/texmf/texmf-dist/tex/latex/biblatex-apa/norwegian-apa.lbx","start":605959,"end":616220},{"filename":"/texmf/texmf-dist/tex/latex/biblatex-apa/nswissgerman-apa.lbx","start":616220,"end":633018},{"filename":"/texmf/texmf-dist/tex/latex/biblatex-apa/nynorsk-apa.lbx","start":633018,"end":643331},{"filename":"/texmf/texmf-dist/tex/latex/biblatex-apa/portuguese-apa.lbx","start":643331,"end":653625},{"filename":"/texmf/texmf-dist/tex/latex/biblatex-apa/romanian-apa.lbx","start":653625,"end":664841},{"filename":"/texmf/texmf-dist/tex/latex/biblatex-apa/russian-apa.lbx","start":664841,"end":675299},{"filename":"/texmf/texmf-dist/tex/latex/biblatex-apa/slovene-apa.lbx","start":675299,"end":686229},{"filename":"/texmf/texmf-dist/tex/latex/biblatex-apa/spanish-apa.lbx","start":686229,"end":697754},{"filename":"/texmf/texmf-dist/tex/latex/biblatex-apa/swedish-apa.lbx","start":697754,"end":707870},{"filename":"/texmf/texmf-dist/tex/latex/biblatex-apa/swissgerman-apa.lbx","start":707870,"end":724538},{"filename":"/texmf/texmf-dist/tex/latex/biblatex-apa/turkish-apa.lbx","start":724538,"end":741909}],"remote_package_size":746005,"package_uuid":"sha256-b8941b63cac651b14034ea46c7fdeb82d5a2cf134087b46750ce464cc33db767"});

  })();
