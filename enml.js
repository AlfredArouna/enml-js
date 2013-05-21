(function() {

  /**
  * URLOfResource
  *  Create URL of the resource on Evernote's server
  * @param  { string } guid - the resource's guid
  * @param  { string } shardId - shard id of the resource owner
  * @return string - URL
  */
  function URLOfResource(guid, shardId){
    return 'https://www.evernote.com/shard/'+shardId+'/res/'+guid;
  }

  /**
  * ENMLOfPlainText
  * @param  { string } text (Plain)
  * @return string - ENML
  */
  function ENMLOfPlainText(text){

    var writer = new XMLWriter();

    writer.startDocument = writer.startDocument || writer.writeStartDocument;
    writer.endDocument = writer.endDocument || writer.writeEndDocument;
    writer.startDocument = writer.startElement || writer.writeStartElement;
    writer.startDocument = writer.endElement || writer.writeEndElement;

    writer.startDocument('1.0', 'UTF-8', false);
    writer.write('<!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd">');
    writer.write("\n");
    writer.startElement('en-note');
    writer.writeAttribute('style', 'word-wrap: break-word; -webkit-nbsp-mode: space; -webkit-line-break: after-white-space;');

    var lines = text.match(/^.*((\r\n|\n|\r)|$)/gm);

    lines.forEach(function(line) {
      writer.startElement('div');
      writer.text(line.replace(/(\r\n|\n|\r)/,''));
      writer.endElement();

      writer.text("\n");
    });

    writer.endElement();
    writer.endDocument();

    return writer.toString();
  }

  /**
  * PlainTextOfENML
  * @param  { string } text (ENML)
  * @return string - text
  */
  function PlainTextOfENML(enml){

    var text = enml || '';
    text = text.replace(/(<\/(div|ui|li)>)/ig,"\n");
    text = text.replace(/(<(li)>)/ig," - ");
    text = text.replace(/(<([^>]+)>)/ig,"");
    text = text.replace(/(\r\n|\n|\r)/gm," ");
    text = text.replace(/(\s+)/gm," ");

    return text;
  }

  /**
  * HTMLOfENML
  *	Convert ENML into HTML for showing in web browsers.
  *
  * @param { string } text (ENML)
  * @param	{ Map <string (hash), url (string) || { url: (string), title: (string) } >, Optional } resources
  * @return string - HTML
  */
  function HTMLOfENML(text, resources){

    resources = resources || {};
    var writer = new XMLWriter();

    var parser = new SaxParser(function(cb) {

      var mediaTagStarted = false;
      var linkTagStarted = false;
      var linkTitle;

      cb.onStartElementNS(function(elem, attrs, prefix, uri, namespaces) {

        if(elem == 'en-note'){
          writer.startElement('html');
          writer.startElement('head');

          writer.startElement('meta');
          writer.writeAttribute('http-equiv', 'Content-Type');
          writer.writeAttribute('content', 'text/html; charset=UTF-8');
          writer.endElement();

          writer.endElement();

          writer.startElement('body');
          if(!(attrs && attrs[0] && attrs[0][0] && attrs[0][0] === 'style'))
            writer.writeAttribute('style', 'word-wrap: break-word; -webkit-nbsp-mode: space; -webkit-line-break: after-white-space;');
        } else if(elem == 'en-todo'){

          writer.startElement('input');
          writer.writeAttribute('type', 'checkbox');

        }	else if(elem == 'en-media'){

          var type = null;
          var hash = null;
          var width = 0;
          var height = 0;

          if(attrs) attrs.forEach(function(attr) {
            if(attr[0] == 'type') type = attr[1];
            if(attr[0] == 'hash') hash = attr[1];
            if(attr[0] == 'width') width = attr[1];
            if(attr[0] == 'height') height = attr[1];
          });

          var resource = resources[hash];
          var resourceUrl;
          var resourceTitle;
          if(resource) {
            resourceUrl = resource.url || resource;
            resourceTitle = resource.title || resource.url || '';
          } else {
            return;
          }

          if(type.match('image')) {
            writer.startElement('img');
            writer.writeAttribute('title', resourceTitle);

          } else if(type.match('audio')) {
            // write link to resource
            writer.startElement('a');
            writer.writeAttribute('href', resourceUrl);
            writer.writeAttribute('class', 'en-res-link');
            writer.text(resourceTitle);
            writer.endElement();
            writer.writeElement('br', '');

            writer.startElement('audio');
            writer.writeAttribute('controls', '');
            writer.text('Your browser does not support the audio tag.');
            writer.startElement('source');
            mediaTagStarted = true;

          } else if(type.match('video')) {
            // write link to resource
            writer.startElement('a');
            writer.writeAttribute('href', resourceUrl);
            writer.writeAttribute('class', 'en-res-link');
            writer.text(resourceTitle);
            writer.endElement();
            writer.writeElement('br', '');

            writer.startElement('video');
            writer.writeAttribute('controls', '');
            writer.text('Your browser does not support the video tag.');
            writer.startElement('source');
            mediaTagStarted = true;
          } else {
            writer.startElement('a');
            linkTagStarted = true;
            linkTitle = resourceTitle;
          }

          if(resourceUrl && linkTagStarted) {
            writer.writeAttribute('href', resourceUrl);
            writer.writeAttribute('class', 'en-res-link');
          } else {
            writer.writeAttribute('src', resourceUrl);
          }

          if(width) writer.writeAttribute ('width', width);
          if(height) writer.writeAttribute('height', height);

        }	else {
          writer.startElement(elem);
        }

        if(attrs) attrs.forEach(function(attr) {
          writer.writeAttribute(attr[0], attr[1]);
        });

      });
      cb.onEndElementNS(function(elem, prefix, uri) {

        if(elem == 'en-note'){
          writer.endElement(); //body
          writer.endElement(); //html
        }
        else if(elem == 'en-todo'){

        }
        else if(elem == 'en-media'){
          if(mediaTagStarted) {
            writer.endElement(); // source
            writer.endElement(); // audio or video
            writer.writeElement('br', '');
            mediaTagStarted = false;

          } else if(linkTagStarted) {
            writer.text(linkTitle);
            writer.endElement(); // a
            linkTagStarted = false;

          } else {
            writer.endElement();
          }
          writer.text("\n");

        } else {

          writer.endElement();
        }
      });
      cb.onCharacters(function(chars) {
        writer.text(chars);
      });

    });

    parser.parseString(text);
    return writer.toString();

  }


  /**
  * TodosOfENML
  *	Extract data of all TODO(s) in ENML text.
  *
  * @param { string } text (ENML)
  * @return { Array [ { text: (string), done: (bool) } ] } -
  */
  function TodosOfENML(text){

    var todos = [];


    var parser = new SaxParser(function(cb) {

      var onTodo = false;
      var text = null;
      var checked = false;

      cb.onStartElementNS(function(elem, attrs, prefix, uri, namespaces) {
        var m = elem.match(/b|u|i|font|strong/);
        if(m && elem == m[0]){

        }
        else if(elem == 'en-todo'){

          checked = false;
          text = "";
          onTodo = true;

          if(attrs) attrs.forEach(function(attr) {
            if(attr[0] == 'checked' && attr[1] == 'true') checked = true;
          });

        }	else {
          if(onTodo){
            todos.push({text: text, checked: checked});
          }
          onTodo = false;
        }

      });
      cb.onEndElementNS(function(elem, prefix, uri) {

      });
      cb.onCharacters(function(chars) {
        if(onTodo){
          text += chars;
        }
      });

    });

    parser.parseString(text);
    return todos;
  }

  /**
  * CheckTodoInENML
  *	Rewrite ENML content by changing check/uncheck value of the TODO in given position.
  *
  * @param { string } text (ENML)
  * @param { int }  index
  * @param { bool } check
  * @return string - ENML (the new content)
  */
  function CheckTodoInENML(text, index, check){

    var todo_cout = 0;
    var writer = new XMLWriter();
    var parser = new SaxParser(function(cb) {

      cb.onStartElementNS(function(elem, attrs, prefix, uri, namespaces) {

        writer.startElement(elem);


        if(elem == 'en-todo' && index == todo_cout++){

          if(attrs) attrs.forEach(function(attr) {
            if(attr[0] == 'checked') return;
            writer.writeAttribute(attr[0], attr[1]);
          });

          if(check)  writer.writeAttribute('checked', 'true');
        }else{

          if(attrs) attrs.forEach(function(attr) {
            writer.writeAttribute(attr[0], attr[1]);
          });
        }
      });
      cb.onEndElementNS(function(elem, prefix, uri) {

        writer.endElement();
      });
      cb.onCharacters(function(chars) {
        writer.text(chars);
      });

    });

    parser.parseString(text);
    return writer.toString();
  }



  var XMLWriter;
  var SaxParser;
  if(typeof exports == 'undefined'){

    XMLWriter = window.XMLWriter;
    SaxParser = window.SaxParser;

    //Browser Code
    window.enml = {};
    window.enml.URLOfResource = URLOfResource;
    window.enml.ENMLOfPlainText = ENMLOfPlainText;
    window.enml.HTMLOfENML = HTMLOfENML;
    window.enml.PlainTextOfENML = PlainTextOfENML;
  }
  else{

    //Node JS
    XMLWriter = require('./lib/xml-writer');
    SaxParser = require('./lib/xml-parser').SaxParser;

    exports.URLOfResource = URLOfResource;
    exports.ENMLOfPlainText = ENMLOfPlainText;
    exports.HTMLOfENML = HTMLOfENML;
    exports.PlainTextOfENML = PlainTextOfENML;
    exports.TodosOfENML = TodosOfENML;
    exports.CheckTodoInENML = CheckTodoInENML;
  }

})();