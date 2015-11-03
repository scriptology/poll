"use strict"

var IScroll = require('./iscroll');

module.exports = function(container, params) {

  var urlGetPoll = params.urlGetPoll,
      urlSendAnswers = params.urlSendAnswers,

      models = {},
      views = {},
      collections = {};


  var getTemplate = function(id) {
      return _.template($('#' + id).html());
  };

  var determineVersion = function(model) {
      var currentVersion = model.get('version');
      var newVersion;

      if (window.innerWidth > 768) {
          newVersion = "desktop";
      } else {
          newVersion = "mobile";
      }

      if (currentVersion !== newVersion) {
          model.set({version: newVersion});
      }
  };

  var sendToServer = function() {
      $.ajax({
          type: "POST",
          url: urlSendAnswers,
          data: JSON.stringify(blank),
          dataType: "json",
          contentType: "application/json; charset=utf-8"
      });
  };

  //Удалить при переносе - информация, для внешнего контейнера о том, сколько осталось вопросов
  var updateInfo = function() {
      if (userInfo.get('done')) {
          $('.js-poll-question-remain').remove();
      } else {
          var questionRemain = questionsCollection.remaining().length;
          if (questionRemain === 0) {
              $('.js-change-info').html('Заполните форму');
          } else {
              var questionRemainText;
              if (questionRemain === 1) {
                  questionRemainText = 'вопрос';
              } else if (questionRemain < 5) {
                  questionRemainText = 'вопроса';
              } else {
                  questionRemainText = 'вопросов'
              }
              $('.js-question-remain-text').html(questionRemainText);
              $('.js-question-remain').html(questionRemain);
          }
      }
  };


  //Класс, описывающий голосовалку
  models.Poll = Backbone.Model.extend({
      initialize: function() {
          var that = this;
          that.set({
              status: 'created'
          });
          determineVersion(this);
      }
  });

  _.extend(window, Backbone.Events);
  window.onresize = function() {
      window.trigger('resize');
  };

  views.PollView = Backbone.View.extend({
      initialize: function() {
          var that = this;

          that.model.on('change:version', function() {
              that.render();
          }, that);

          that.listenTo(window, 'resize', _.debounce(function() {
              determineVersion(this.model)
          }, 50));
      },

      render: function() {
          var that = this;

          if (that.model.get('status') === 'created') {

              var questionsCollectionView = new views.QuestionsCollectionView({ collection: questionsCollection });
              $boxList.html(questionsCollectionView.render());
              $(container).html($boxList);

              if (that.model.get('version') === 'desktop') {
                  $(container).append($boxDetail);
              }

              var iScroll = new IScroll('.box-list', {
                  scrollbars: true,
                  mouseWheel: true,
                  click: true,
                  preventDefault: false
              });

          } else if (that.model.get('status') === 'loaded') {

              if (that.model.get('version') === 'mobile') {
                  $(container).find($boxDetail).remove();
              } else if (that.model.get('version') === 'desktop') {
                  $(container).append($boxDetail);
              }

              questionsCollection.each(function(question) {
                  if (question.get('active')) {
                      question.set({active: false});
                      question.set({active: true});
                  }
              }, that);
          }

          if (that.model.get('version') === 'mobile') {
              $('.poll-container').removeClass('desktop').addClass('mobile');
          } else if (that.model.get('version') === 'desktop') {
              $('.poll-container').removeClass('mobile').addClass('desktop');
          }

          //Удалить при переносе - информация, для внешнего контейнера о том, сколько осталось вопросов
          updateInfo();
      }
  });


  //Класс, описывающий один вопрос
  models.Question = Backbone.Model.extend({
      initialize: function() {
          var that = this;
          that.set({readyToAnswer: false});

          if (that.get('active') === undefined) {
              that.set({active: false});
          }

          if (!that.get('answer')) {
              that.set({
                  answer: null,
                  answered: false
              });
          } else {
              that.set({
                  answered: true
              });
          }
      }
  });

  views.QuestionView = Backbone.View.extend({
      tagName: 'li',
      className: 'question',
      template: getTemplate('js-template-question'),

      initialize: function() {
          var that = this;
          that.model.on('change:active', function() {
              that.render();
          }, that);
      },

      render: function() {
          var currentModel = this.model;
          var currentElement = this.$el;
          var template = this.template(currentModel.toJSON());
          currentElement.html(template);

          if (currentModel.get('answered')) {
              currentElement.addClass('answered');
          }

          //У активного элемента рендерится view детального описания вопроса
          if (currentModel.get('active')) {
              var questionDetailView = new views.QuestionDetailView({ model: currentModel });
              if (poll.get('version') === 'desktop') {
                  $boxDetail.html(questionDetailView.render());
              } else if (poll.get('version') === 'mobile') {
                  currentElement.append(questionDetailView.render());
              }

              //Инициализируем Selectize после того как отрендерился детальный вопрос, так как до этого момента нечего инициализировать
              if (currentModel.get('type') === 'select' && currentModel.get('active')) {
                  initSelect(currentModel.get('src'));
              }

              currentElement.addClass('active');
          } else {
              currentElement.removeClass('active');
          }

          return this.el;
      },

      events: {
          'click': 'chooseQuestion'

      },

      chooseQuestion: function() {
          var currentModel = this.model;
          questionsCollection.each(function(model) {
              if(currentModel.collection.indexOf(currentModel) !== model.collection.indexOf(model)) {
                  model.set({
                      active: false,
                      readyToAnswer: false
                  });
              } else {
                  model.set({active: true});
              }
          });
          userInfo.set({active: false});
      }
  });

  views.QuestionDetailView = Backbone.View.extend({
      tagName: 'div',
      className: 'question-detail',
      minNecessarySymbols: 3,

      initialize: function() {
          var currentModel = this.model;
          if (currentModel.get('type') === 'select') {
              this.template = getTemplate('js-template-question-detail-select');
          } else if (currentModel.get('type') === 'text') {
              this.template = getTemplate('js-template-question-detail-text');
          }
      },

      render: function() {
          var template = this.template(this.model.toJSON());
          this.$el.html(template);

          return this.el;
      },

      events: {
          'click .js-btn-answer': 'answer',
          'click .js-btn-skip': 'nextQuestion',
          'keyup .js-field-answer': 'readyToAnswer',
          'change .js-selectize-poll': 'readyToAnswer'
      },

      answer: function(event) {
          var e = event || false;
          if (e) {
              e.stopImmediatePropagation();
              e.preventDefault();
          }

          var currentModel = this.model;
          var currentElement = this.$el;

          if (currentModel.get('readyToAnswer')) {
              var answer;
              var toggleToAnswering = false;

              if (currentModel.get('type') === 'select') {
                  var selectize = currentElement.find('.selectize-input');
                  if (selectize.children().length > 1) {
                      answer = currentElement.find('.selectize-input .item').html();
                      toggleToAnswering = true;
                  }

              } else if (currentModel.get('type') === 'text') {
                  answer = $('.js-field-answer').val();
                  if (answer.length >= this.minNecessarySymbols) {
                      toggleToAnswering = true;
                  }
              }

              if (toggleToAnswering) {
                  currentModel.set({
                      answer: answer,
                      answered: true,
                      readyToAnswer: false
                  });

                  //Теперь нужно обновить "слепок" ответов
                  var currentModelID = currentModel.get('id');
                  var blankAnswers = blank.answers;
                  var sameBlankAnswer = _.findWhere(blankAnswers, {
                      questionID: currentModelID
                  });

                  if (sameBlankAnswer) {
                      sameBlankAnswer.value = currentModel.get('answer');
                  } else {
                      var newAnswer = function(){
                          return {
                              questionID: currentModel.get('id'),
                              value: currentModel.get('answer')
                          };
                      };
                      blankAnswers.push(newAnswer());
                  }

                  //Отправляем слепок на сервер
                  sendToServer();

                  //Удалить при переносе - информация, для внешнего контейнера о том, сколько осталось вопросов
                  updateInfo();

                  //Переключаемся на следующий вопрос
                  if (questionsCollection.remaining().length === 0) {
                      poll.set({status: 'answered'});
                      currentModel.set({active: false});
                      userInfo.set({active: true});

                      var userInfoDetailView = new views.UserInfoDetailView({ model: userInfo });
                      $(container).html(userInfoDetailView.render());
                  } else {
                      this.nextQuestion();
                  }
              }
          } else {
              var input;
              if (currentModel.get('type') === 'select') {
                  input = currentElement.find('.selectize-input');
                  input.addClass('error-input');
              } else {
                  input = currentElement.find('input.js-field-answer');
                  input.addClass('error-input');
              }
          }
      },

      nextQuestion: function(event) {
          //При срабатывании этого события нужно остановить срабатывание события "chooseQuestion", которое относится к другой view
          var e = event || false;
          if (e) {
              e.stopImmediatePropagation();
          }

          var currentModel = this.model;
          var currentModelIndex = questionsCollection.indexOf(currentModel);
          var nextModel;

          if (currentModelIndex === questionsCollection.length - 1) {
              nextModel = questionsCollection.at(0);
          } else {
              nextModel = questionsCollection.at(currentModelIndex + 1);
          }

          var counter = 1;
          while (nextModel.get('answered') && counter < 100) {
              counter++;
              if ((currentModelIndex + counter) >= questionsCollection.length) {
                  counter = counter - (questionsCollection.length);
              }
              nextModel = questionsCollection.at(currentModelIndex + counter);
          }

          currentModel.set({
              active: false,
              readyToAnswer: false
          });
          nextModel.set({active: true});
      },

      readyToAnswer: function() {
          var currentModel = this.model;
          var currentElement = this.$el;
          var buttonAnswer = currentElement.find('.js-btn-answer');
          var answer;
          var input;

          if (currentModel.get('type') === 'select' && currentModel.get('active')) {
              input = currentElement.find('.selectize-input');

              if (input.hasClass('error-input')) {
                  input.removeClass('error-input');
              }

              if (input.children().length > 1) {
                  answer = currentElement.find('.selectize-input .item').html();
              }

              if (answer) {
                  if (!currentModel.get('readyToAnswer')) {
                      currentModel.set({readyToAnswer: true});
                  }
              } else {
                  if (currentModel.get('readyToAnswer')) {
                      currentModel.set({readyToAnswer: false});
                  }
              }

          } else if (currentModel.get('type') === 'text' && currentModel.get('active')) {
              input = currentElement.find('input.js-field-answer');

              if (input.hasClass('error-input')) {
                  input.removeClass('error-input');
              }

              answer = input.val();
              if (answer.length >= this.minNecessarySymbols) {
                  if (!currentModel.get('readyToAnswer')) {
                      currentModel.set({readyToAnswer: true});
                  }
              } else {
                  if (currentModel.get('readyToAnswer')) {
                      currentModel.set({readyToAnswer: false});
                  }
              }
          }

          if (currentModel.get('readyToAnswer')) {
              if (buttonAnswer.hasClass('disabled')) {
                  buttonAnswer.removeClass('disabled');
              }
          } else {
              if (!buttonAnswer.hasClass('disabled')) {
                  buttonAnswer.addClass('disabled');
              }
          }
      }
  });


  //Класс-коллекция описывающий список вопросов
  collections.QuestionsCollection = Backbone.Collection.extend({
      model: models.Question,
      url: urlGetPoll,

      parse: function(data){
          return data.poll.questions;
      },

      //Фильтр для получения списка вопросов, которые завершены
      done: function() {
          return this.filter(function(question){ return question.get('answered'); });
      },

      //Фильтр для получения списка вопросов, которые не завершены
      remaining: function() {
          return this.without.apply(this, this.done());
      }
  });

  views.QuestionsCollectionView = Backbone.View.extend({
      tagName: 'ul',
      className: 'questions-list',

      initialize: function() {},

      render: function() {
          var that = this;
          that.collection.each(function(question) {
              var questionView = new views.QuestionView({ model: question });
              that.$el.append(questionView.render());
          }, that);
          return that.el;
      }
  });


  //Класс описывающий информацию о пользователе, ответившего на все вопросы
  models.UserInfo = Backbone.Model.extend({
      initialize: function() {
          var that = this;
          if (that.get('active') === undefined) {
              that.set({active: false});
          }
          if (that.get('done') === undefined) {
              that.set({done: false});
          }
      }
  });

  views.UserInfoView = Backbone.View.extend({
      tagName: 'li',
      className: 'question',
      template: getTemplate('js-template-user-info'),

      initialize: function() {
          this.model.on('change:active', function() {
              this.render();
          }, this);
      },

      render: function() {
          var currentModel = this.model;
          var thatElement = this.$el;
          var template = this.template(currentModel.toJSON());
          thatElement.html(template);

          if (currentModel.get('done')) {
              thatElement.addClass('answered');
          }

          if (currentModel.get('active')) {
              var userInfoDetailView = new views.UserInfoDetailView({ model: currentModel });
              $('.box-detail').html(userInfoDetailView.render());
              thatElement.addClass('active');
          } else {
              thatElement.removeClass('active');
          }

          return this.el;
      },

      events: {
          'click' : 'clickHandle'
      },

      clickHandle: function() {
          var that = this;

          questionsCollection.each(function(question) {
              question.set({active: false});
          }, that);

          that.model.set({active: true});
      }
  });

  views.UserInfoDetailView = Backbone.View.extend({
      tagName: 'div',
      className: 'question-detail',
      //template: getTemplate('js-template-user-info-detail'),

      initialize: function() {
          if (this.model.get('done')) {
              this.template = getTemplate('js-template-thanks');
          } else {
              this.template = getTemplate('js-template-user-info-detail');
          }
      },

      render: function() {
          var template = this.template(this.model.toJSON());
          this.$el.html(template);

          return this.el;
      },

      events: {
          'click .js-btn-answer': 'submitData'
      },

      submitData: function(event) {
          //event.stopImmediatePropagation();
          //event.preventDefault();

          var currentModel = this.model;

          var parsleyContainer = $('.js-parsley-form');
          parsleyContainer.parsley({
              errorsWrapper: false
          });

          if (parsleyContainer.parsley().validate()) {
              var firstName = $('#js-first-name').val();
              var lastName = $('#js-last-name').val();
              var email = $('#js-email').val();
              var phone = $('#js-phone').val();

              var agreePartisipation = function() {
                  var checked = false;
                  if ($('input#js-agree-partisipation').prop('checked')) {
                      checked = true;
                  }
                  return checked;
              };

              var agreePolicy = function() {
                  var checked = false;
                  if ($('input#js-agree-policy').prop('checked')) {
                      checked = true;
                  }
                  return checked;
              };

              var agreeNews = function() {
                  var checked = false;
                  if ($('input#js-agree-news').prop('checked')) {
                      checked = true;
                  }
                  return checked;
              };

              currentModel.set({
                  done: true,
                  firstName: firstName,
                  lastName: lastName,
                  email: email,
                  phone: phone,
                  agreePartisipation: agreePartisipation(),
                  agreePolicy: agreePolicy(),
                  agreeNews: agreeNews()
              });

              //Обновляем данные в "слепке"
              _.extend(blank.voter, currentModel.attributes);

              //Отправляем "слепок" на сервер
              sendToServer();
              poll.set({status: 'submitted'});

              //Деактивируем элемент
              currentModel.set({active: false});

              //Удалить при переносе - информация, для внешнего контейнера о том, сколько осталось вопросов
              updateInfo();

              //Запуск отрисовки благолдарности
              this.initialize();
              this.render();
          }
      }
  });


  //Создаем коллекцию и интерфейс списка вопросов
  var poll = new models.Poll;
  var pollView = new views.PollView({ model: poll });
  var userInfo = new models.UserInfo;
  var questionsCollection = new collections.QuestionsCollection;

  var $boxDetail = $('<div class="box-detail"></div>');
  var $boxList = $('<div class="box-list"></div>');
  //Создаем объект, хранящий информацию, которую нужно будет отправлять
  var blank;

  $.when(
      //Заполняем коллекцию данными с сервера
      questionsCollection.fetch(),

      //Запрашиваем данные, которые пользователь уже ввел в рамках текущей сессии
      $.getJSON(urlSendAnswers, function(data) {
          blank = data;
      })
  ).then(function() {
          //У каждой модели коллекции обновляем поле ответа с помощью данных, которые содержатся в "слепке"
          questionsCollection.each(function(model) {
              var currentModelID = model.attributes.id;
              var sameBlankAnswer = _.findWhere(blank.answers, {
                  questionID: currentModelID
              });

              if (sameBlankAnswer) {
                  model.set({
                      answer: sameBlankAnswer.value,
                      answered: true
                  });
              }
          });

          //Обновляем данные о пользователе с помощью данных, которые содержатся в "слепке"
          _.extend(userInfo.attributes, blank.voter);

          //Отрисовываем всю коллекцию через отрисовку глобалной модели
          pollView.render();

          //Меняем статус глобальной модели
          poll.set({status: 'loaded'});

  }, function() {
          console.log("Как минимум один из ajax-запросов выполнен неуспешно");
  });

  //Инициализация Selectize
  var initSelect = function(url) {
      var $select = $('.js-selectize-poll').selectize({
          valueField: 'id',
          labelField: 'name',
          searchField: 'name',

          preload: true,
          create: false,
          render: {
              option: function(item, escape) {
                  return '<div>'+ escape(item.name) +'</div>';
              }
          },

          load: function(query, callback) {
              $.ajax({
                  url: url,
                  type: 'GET',
                  dataType: 'json',
                  data: {
                      name: query
                  },
                  error: function() {
                      callback();
                  },
                  success: function(res) {
                      callback(res.options.slice(0, 5));
                  }
              });
          }
      });
  };

};
