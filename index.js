'use strict';
var util = require('util'),
    bluebird = require('bluebird'),
    xray = require('x-ray'),
    jade = require('jade'),
    path = require('path'),
    fs = bluebird.promisifyAll(require('fs'));

function containsVOSTRF(item) {
  return item.titre.indexOf('VOSTFR') > 0;
}

var getDescription = bluebird.promisify(function(item, index, arrayLength, callback) {
  xray(item.lien)
    .select({
      texteFiche: '#textefiche',
      cover: '#bigcover img[src]',
      torrent: '#telecharger[href]'
    })
    .run(function(err, description) {
      item.description = description;
      item.description.texteFiche = description.texteFiche.trim().replace(/\n/g, '<br>');
      return callback(err, item);
    });
});

var getAllVOSTFRFiles = bluebird.promisify(function(url, callback) {
  xray(url)
    .select([
      {
        $root: '.ligne0, .ligne1',
        titre: '.titre',
        lien: '.titre[href]',
        tag: '.titre[title]',
        taille: '.poid'
      }
    ])
    .paginate('#pagination a:last-child[href]')
    .limit(10)
    .run(callback);
});

var render = function(compiledTemplate) {
  return bluebird.promisify(function(results, callback) {
    var context = {
      results: results
    };
    console.log('Templating...');
    var output = compiledTemplate(context);
    return callback(null, output);
  });
};

if (require.main === module) {
  util.log('-- xray test on cpasbien --');

  // we load and compile the output template
  var templateFilename = path.join(__dirname, 'template.jade'),
      compiledTemplate = jade.compileFile(templateFilename, { pretty: true, filename: templateFilename });

  // var urlSeries = 'http://www.cpasbien.pw/view_cat.php?categorie=series';
  var urlFilms = 'http://www.cpasbien.pw/view_cat.php?categorie=films';

  getAllVOSTFRFiles(urlFilms)
    .filter(containsVOSTRF)
    .map(getDescription, { concurrency: 5 } )
    .then(render(compiledTemplate))
    .then(function(results) {
      console.log('Writing...');
      fs.writeFileAsync('cpasbien.html', results)
        .then(function () {
          console.log('File saved.');
        })
        .catch(function (error) {
          console.log(error.stack);
        });
    })
    .catch(function (error) {
      console.log(error.stack);
    });
}

