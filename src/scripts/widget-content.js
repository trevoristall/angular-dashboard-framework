/*
 * The MIT License
 *
 * Copyright (c) 2015, Sebastian Sdorra
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

'use strict';

angular.module('adf.core')
  .directive('adfWidgetContent', function($log, $q, widgetService,
          $compile, $controller, $injector, dashboard) {

    function renderError($element, msg){
        $log.warn(msg);
        $element.html(dashboard.messageTemplate.replace(/{}/g, msg));
    }

    function compileWidget($scope, $element, currentScope) {
      var model = $scope.model;
      var content = $scope.content;

      var newScope = currentScope;
      if (!model){
        renderError($element, 'model is undefined')
      } else if (!content){
        var msg = 'widget content is undefined, please have a look at your browser log';
        renderError($element, msg);
      } else {
        newScope = renderWidget($scope, $element, currentScope, model, content);
      }
      return newScope;
    }

    function renderWidget($scope, $element, currentScope, model, content) {
      // display loading template on initial load
      if (!currentScope && (model.loadingTemplateUrl || dashboard.loadingTemplate)) {
        if (model.loadingTemplateUrl) {
          widgetService.getTemplateFromUrl(model.loadingTemplateUrl)
            .then(function (loadingTemplate) {
              $element.html(loadingTemplate);
            });
        } else {
          $element.html(dashboard.loadingTemplate);
        }
      }
      
      // create new scope
      var templateScope = $scope.$new();

      // pass config object to scope
      if (!model.config) {
        model.config = {};
      }

      templateScope.config = model.config;

      // local injections
      var base = {
        $scope: templateScope,
        widget: model,
        config: model.config
      };

      // get resolve promises from content object
      var resolvers = {};
      resolvers.$tpl = widgetService.getTemplate(content);
      if (content.resolve) {
        angular.forEach(content.resolve, function(promise, key) {
          if (angular.isString(promise)) {
            resolvers[key] = $injector.get(promise);
          } else {
            resolvers[key] = $injector.invoke(promise, promise, base);
          }
        });
      }

      // resolve all resolvers
      $q.all(resolvers).then(function(locals) {
        angular.extend(locals, base);

        // pass resolve map to template scope as defined in resolveAs
        if (content.resolveAs){
          templateScope[content.resolveAs] = locals;
        }

        // compile & render template
        var template = locals.$tpl;
        $element.html(template);
        if (content.controller) {
          var templateCtrl = $controller(content.controller, locals);
          if (content.controllerAs) {
            templateScope[content.controllerAs] = templateCtrl;
          }
          $element.children().data('$ngControllerController', templateCtrl);
        }
        $compile($element.contents())(templateScope);
      }, function(reason) {
        // handle promise rejection
        var msg = 'Could not resolve all promises';
        if (reason) {
          msg += ': ' + reason;
        }
        renderError($element, msg);
      });

      // destroy old scope
      if (currentScope) {
        currentScope.$destroy();
      }

      return templateScope;
    }

    return {
      replace: true,
      restrict: 'EA',
      transclude: false,
      scope: {
        model: '=',
        content: '='
      },
      link: function($scope, $element) {
        var currentScope = compileWidget($scope, $element, null);
        $scope.$on('widgetConfigChanged', function() {
          currentScope = compileWidget($scope, $element, currentScope);
        });
        $scope.$on('widgetReload', function() {
          currentScope = compileWidget($scope, $element, currentScope);
        });
      }
    };

  });
