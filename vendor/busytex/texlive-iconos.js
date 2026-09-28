// \ProvidesPackage{fontawesome}
// \ProvidesPackage{fontawesome5}
// \ProvidesPackage{fontawesome5-generic-helper}
// \ProvidesPackage{fontawesome5-utex-helper}
// \ProvidesPackage{tikzfill}
// \ProvidesPackage{tikzfill.geomarray}
// \ProvidesPackage{tikzfill.hexagon}
// \ProvidesPackage{tikzfill.image}
// \ProvidesPackage{tikzfill.rhombus}

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
      var PACKAGE_NAME = 'build/wasm/texlive-iconos.data';
      var REMOTE_PACKAGE_BASE = 'texlive-iconos.data';
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
    Module['FS_createPath']("/texmf/texmf-dist", "fonts", true, true);
    Module['FS_createPath']("/texmf/texmf-dist", "tex", true, true);
    Module['FS_createPath']("/texmf/texmf-dist/fonts", "enc", true, true);
    Module['FS_createPath']("/texmf/texmf-dist/fonts", "map", true, true);
    Module['FS_createPath']("/texmf/texmf-dist/fonts", "tfm", true, true);
    Module['FS_createPath']("/texmf/texmf-dist/fonts", "type1", true, true);
    Module['FS_createPath']("/texmf/texmf-dist/tex", "latex", true, true);
    Module['FS_createPath']("/texmf/texmf-dist/fonts/enc", "dvips", true, true);
    Module['FS_createPath']("/texmf/texmf-dist/fonts/map", "dvips", true, true);
    Module['FS_createPath']("/texmf/texmf-dist/fonts/tfm", "public", true, true);
    Module['FS_createPath']("/texmf/texmf-dist/fonts/type1", "public", true, true);
    Module['FS_createPath']("/texmf/texmf-dist/tex/latex", "fontawesome", true, true);
    Module['FS_createPath']("/texmf/texmf-dist/tex/latex", "fontawesome5", true, true);
    Module['FS_createPath']("/texmf/texmf-dist/tex/latex", "tikzfill", true, true);
    Module['FS_createPath']("/texmf/texmf-dist/fonts/enc/dvips", "fontawesome", true, true);
    Module['FS_createPath']("/texmf/texmf-dist/fonts/enc/dvips", "fontawesome5", true, true);
    Module['FS_createPath']("/texmf/texmf-dist/fonts/map/dvips", "fontawesome", true, true);
    Module['FS_createPath']("/texmf/texmf-dist/fonts/map/dvips", "fontawesome5", true, true);
    Module['FS_createPath']("/texmf/texmf-dist/fonts/tfm/public", "fontawesome", true, true);
    Module['FS_createPath']("/texmf/texmf-dist/fonts/tfm/public", "fontawesome5", true, true);
    Module['FS_createPath']("/texmf/texmf-dist/fonts/type1/public", "fontawesome", true, true);
    Module['FS_createPath']("/texmf/texmf-dist/fonts/type1/public", "fontawesome5", true, true);

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
        var compressedData = {"data":null,"cachedOffset":1150347,"cachedIndexes":[-1,-1],"cachedChunks":[null,null],"offsets":[0,2048,4096,6144,8192,10240,12288,14336,16384,18432,20480,22528,24576,26624,28672,30720,32768,34816,36864,38912,40960,43008,45056,47104,49152,51200,53248,55296,57344,59392,61440,63488,65536,67584,69632,71680,73728,75776,77824,79872,81920,83968,86016,88064,90112,92160,94208,96256,98304,100352,102400,104448,106496,108544,110592,112640,114688,116736,118784,120832,122880,124928,126976,129024,131072,133120,135168,137216,139264,141312,143360,145408,147456,149504,151552,153600,155648,157696,159744,161792,163840,165888,167936,169984,172032,174080,176128,178176,180224,182272,184320,186368,188416,190464,192512,194560,196608,198656,200704,202752,204800,206848,208896,210944,212992,215040,217088,219136,221184,223232,225280,227328,229376,231424,233472,235520,237568,239616,241664,243712,245760,247808,249856,251904,253952,256000,258048,260096,262144,264192,266240,268288,270336,272384,274432,276480,278528,280576,282624,284672,286720,288768,290816,292864,294912,296960,299008,301056,303104,305152,307200,309248,311296,313344,315392,317440,319488,321536,323584,325632,327680,329728,331776,333824,335872,337920,339968,342016,344064,346112,348160,350208,352256,354304,356352,358400,360448,362496,364544,366592,368640,370688,372736,374784,376832,378880,380928,382976,385024,387072,389120,391168,393216,395264,397312,399360,401408,403456,405504,407552,409600,411648,413696,415744,417792,419840,421888,423936,425984,428032,430080,432128,434176,436224,438272,440320,442368,444416,446464,448512,450560,452608,454656,456704,458752,460800,462848,464896,466944,468992,471040,473088,475136,477184,479232,481280,483328,485376,487424,489472,491520,493568,495616,497664,499712,501760,503808,505856,507904,509952,512000,514048,516096,518144,520192,522240,524288,526336,528384,530432,532480,534528,536576,538624,540672,542720,544768,546816,548864,550912,552960,555008,557056,559104,561152,563200,565248,567296,569344,571392,573440,575488,577536,579584,581632,583680,585728,587776,589824,591872,593920,595968,598016,600064,602112,604160,606208,608256,610304,612352,614400,616448,618496,620544,622592,624640,626688,628736,630784,632832,634880,636928,638976,641024,643072,645120,647168,649216,651264,653312,655360,657408,659456,661504,663552,665600,667648,669696,671744,673792,675840,677888,679936,681984,684032,686080,688128,690176,692224,694272,696320,698368,700416,702464,704512,706560,708608,710656,712704,714752,716800,718848,720896,722944,724992,727040,729088,731136,733184,735232,737280,739328,741376,743424,745472,747520,749568,751616,753664,755712,757760,759808,761856,763904,765952,768000,770048,772096,774144,776192,778240,780288,782336,784384,786432,788480,790528,792576,794624,796672,798720,800768,802816,804864,806912,808960,811008,813056,815104,817152,819200,821248,823296,825344,827392,829440,831488,833536,835584,837632,839680,841728,843776,845824,847872,849920,851968,854016,856064,858112,860160,862208,864256,866304,868352,870400,872448,874496,876544,878592,880640,882688,884736,886784,888832,890880,892928,894976,897024,899072,901120,903168,905216,907264,909312,911360,913408,915456,917504,919552,921600,923648,925696,927744,929792,931840,933888,935936,937984,940032,942080,944128,946176,948224,950272,952320,954368,956416,958464,960512,962560,964608,966656,968704,970752,972800,974848,976896,978944,980992,983040,985088,987136,989184,991232,993280,995328,997376,999424,1001472,1003520,1005568,1007616,1009664,1011712,1013760,1015808,1017856,1019904,1021952,1024000,1026048,1028096,1030144,1032192,1034240,1036288,1038336,1040384,1042432,1044480,1046528,1048576,1050624,1052672,1054720,1056768,1058816,1060864,1062912,1064960,1067008,1069056,1071104,1073152,1075200,1077248,1079296,1081344,1083392,1085440,1087488,1089536,1091584,1093632,1095680,1097728,1099776,1101824,1103872,1105920,1107968,1110016,1112064,1114112,1116160,1118208,1120256,1122304,1124352,1126400,1128448,1130496,1132544,1134592,1136640,1138688,1140736,1142784,1144832,1146880,1148928],"sizes":[2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,1419],"successes":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]}
;
            compressedData['data'] = byteArray;
            assert(typeof Module['LZ4'] === 'object', 'LZ4 not present - was your app build with -sLZ4?');
            Module['LZ4'].loadPackage({ 'metadata': metadata, 'compressedData': compressedData }, false);
            Module['removeRunDependency']('datafile_build/wasm/texlive-iconos.data');
      };
      Module['addRunDependency']('datafile_build/wasm/texlive-iconos.data');

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
    loadPackage({"files":[{"filename":"/texmf/texmf-dist/fonts/enc/dvips/fontawesome/fontawesomeone.enc","start":0,"end":1687},{"filename":"/texmf/texmf-dist/fonts/enc/dvips/fontawesome/fontawesomethree.enc","start":1687,"end":4124},{"filename":"/texmf/texmf-dist/fonts/enc/dvips/fontawesome/fontawesometwo.enc","start":4124,"end":6803},{"filename":"/texmf/texmf-dist/fonts/enc/dvips/fontawesome5/fa5brands0.enc","start":6803,"end":9723},{"filename":"/texmf/texmf-dist/fonts/enc/dvips/fontawesome5/fa5brands1.enc","start":9723,"end":12331},{"filename":"/texmf/texmf-dist/fonts/enc/dvips/fontawesome5/fa5free0.enc","start":12331,"end":15414},{"filename":"/texmf/texmf-dist/fonts/enc/dvips/fontawesome5/fa5free1.enc","start":15414,"end":18456},{"filename":"/texmf/texmf-dist/fonts/enc/dvips/fontawesome5/fa5free2.enc","start":18456,"end":21362},{"filename":"/texmf/texmf-dist/fonts/enc/dvips/fontawesome5/fa5free3.enc","start":21362,"end":24267},{"filename":"/texmf/texmf-dist/fonts/map/dvips/fontawesome/fontawesome.map","start":24267,"end":24895},{"filename":"/texmf/texmf-dist/fonts/map/dvips/fontawesome5/fontawesome5.map","start":24895,"end":25977},{"filename":"/texmf/texmf-dist/fonts/tfm/public/fontawesome/FontAwesome--fontawesomeone.tfm","start":25977,"end":27337},{"filename":"/texmf/texmf-dist/fonts/tfm/public/fontawesome/FontAwesome--fontawesomethree.tfm","start":27337,"end":28145},{"filename":"/texmf/texmf-dist/fonts/tfm/public/fontawesome/FontAwesome--fontawesometwo.tfm","start":28145,"end":29505},{"filename":"/texmf/texmf-dist/fonts/tfm/public/fontawesome5/fa5brands0.tfm","start":29505,"end":30885},{"filename":"/texmf/texmf-dist/fonts/tfm/public/fontawesome5/fa5brands1.tfm","start":30885,"end":32025},{"filename":"/texmf/texmf-dist/fonts/tfm/public/fontawesome5/fa5free0regular.tfm","start":32025,"end":33157},{"filename":"/texmf/texmf-dist/fonts/tfm/public/fontawesome5/fa5free0solid.tfm","start":33157,"end":34485},{"filename":"/texmf/texmf-dist/fonts/tfm/public/fontawesome5/fa5free1regular.tfm","start":34485,"end":35689},{"filename":"/texmf/texmf-dist/fonts/tfm/public/fontawesome5/fa5free1solid.tfm","start":35689,"end":37005},{"filename":"/texmf/texmf-dist/fonts/tfm/public/fontawesome5/fa5free2regular.tfm","start":37005,"end":38113},{"filename":"/texmf/texmf-dist/fonts/tfm/public/fontawesome5/fa5free2solid.tfm","start":38113,"end":39453},{"filename":"/texmf/texmf-dist/fonts/tfm/public/fontawesome5/fa5free3regular.tfm","start":39453,"end":40533},{"filename":"/texmf/texmf-dist/fonts/tfm/public/fontawesome5/fa5free3solid.tfm","start":40533,"end":41769},{"filename":"/texmf/texmf-dist/fonts/type1/public/fontawesome/FontAwesome.pfb","start":41769,"end":214988},{"filename":"/texmf/texmf-dist/fonts/type1/public/fontawesome5/FontAwesome5Brands-Regular.pfb","start":214988,"end":419246},{"filename":"/texmf/texmf-dist/fonts/type1/public/fontawesome5/FontAwesome5Free-Regular.pfb","start":419246,"end":477742},{"filename":"/texmf/texmf-dist/fonts/type1/public/fontawesome5/FontAwesome5Free-Solid.pfb","start":477742,"end":773065},{"filename":"/texmf/texmf-dist/tex/latex/fontawesome/fontawesome.sty","start":773065,"end":775822},{"filename":"/texmf/texmf-dist/tex/latex/fontawesome/fontawesomesymbols-generic.tex","start":775822,"end":809056},{"filename":"/texmf/texmf-dist/tex/latex/fontawesome/fontawesomesymbols-pdftex.tex","start":809056,"end":855485},{"filename":"/texmf/texmf-dist/tex/latex/fontawesome/fontawesomesymbols-xeluatex.tex","start":855485,"end":901267},{"filename":"/texmf/texmf-dist/tex/latex/fontawesome/ufontawesomeone.fd","start":901267,"end":901786},{"filename":"/texmf/texmf-dist/tex/latex/fontawesome/ufontawesomethree.fd","start":901786,"end":902319},{"filename":"/texmf/texmf-dist/tex/latex/fontawesome/ufontawesometwo.fd","start":902319,"end":902838},{"filename":"/texmf/texmf-dist/tex/latex/fontawesome5/fontawesome5-generic-helper.sty","start":902838,"end":904634},{"filename":"/texmf/texmf-dist/tex/latex/fontawesome5/fontawesome5-mapping.def","start":904634,"end":1012442},{"filename":"/texmf/texmf-dist/tex/latex/fontawesome5/fontawesome5-utex-helper.sty","start":1012442,"end":1017714},{"filename":"/texmf/texmf-dist/tex/latex/fontawesome5/fontawesome5.lua","start":1017714,"end":1019592},{"filename":"/texmf/texmf-dist/tex/latex/fontawesome5/fontawesome5.sty","start":1019592,"end":1027704},{"filename":"/texmf/texmf-dist/tex/latex/fontawesome5/tufontawesomebrands.fd","start":1027704,"end":1028956},{"filename":"/texmf/texmf-dist/tex/latex/fontawesome5/tufontawesomefree.fd","start":1028956,"end":1030031},{"filename":"/texmf/texmf-dist/tex/latex/fontawesome5/tufontawesomepro.fd","start":1030031,"end":1031392},{"filename":"/texmf/texmf-dist/tex/latex/fontawesome5/ufontawesomebrands0.fd","start":1031392,"end":1032598},{"filename":"/texmf/texmf-dist/tex/latex/fontawesome5/ufontawesomebrands1.fd","start":1032598,"end":1033804},{"filename":"/texmf/texmf-dist/tex/latex/fontawesome5/ufontawesomefree0.fd","start":1033804,"end":1034784},{"filename":"/texmf/texmf-dist/tex/latex/fontawesome5/ufontawesomefree1.fd","start":1034784,"end":1035764},{"filename":"/texmf/texmf-dist/tex/latex/fontawesome5/ufontawesomefree2.fd","start":1035764,"end":1036744},{"filename":"/texmf/texmf-dist/tex/latex/fontawesome5/ufontawesomefree3.fd","start":1036744,"end":1037724},{"filename":"/texmf/texmf-dist/tex/latex/tikzfill/tikzfill.geomarray.sty","start":1037724,"end":1038888},{"filename":"/texmf/texmf-dist/tex/latex/tikzfill/tikzfill.hexagon.sty","start":1038888,"end":1040036},{"filename":"/texmf/texmf-dist/tex/latex/tikzfill/tikzfill.image.sty","start":1040036,"end":1041164},{"filename":"/texmf/texmf-dist/tex/latex/tikzfill/tikzfill.rhombus.sty","start":1041164,"end":1042312},{"filename":"/texmf/texmf-dist/tex/latex/tikzfill/tikzfill.sty","start":1042312,"end":1043525},{"filename":"/texmf/texmf-dist/tex/latex/tikzfill/tikzlibraryfill.geomarray.code.tex","start":1043525,"end":1119443},{"filename":"/texmf/texmf-dist/tex/latex/tikzfill/tikzlibraryfill.hexagon.code.tex","start":1119443,"end":1132026},{"filename":"/texmf/texmf-dist/tex/latex/tikzfill/tikzlibraryfill.image.code.tex","start":1132026,"end":1143113},{"filename":"/texmf/texmf-dist/tex/latex/tikzfill/tikzlibraryfill.rhombus.code.tex","start":1143113,"end":1150347}],"remote_package_size":1154443,"package_uuid":"sha256-c32f219a5ba5b9815e22286863b801a7e0c9047cc599a536432f10645b58b081"});

  })();
