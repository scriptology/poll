"use strict";

var NProgress = require("nprogress");
NProgress.configure({
    parent: '.selectize-input',
    template: '<div role="bar"><div class="peg"></div></div><div class="spinner" role="spinner"><div class="spinner-icon"></div></div>' //изменен шаблон для того, чтобы скрыть bar
});


var IScroll = require('./iscroll');

module.exports = function(container, params) {

    var urlGetPoll = params.urlGetPoll,
        urlSendAnswers = params.urlSendAnswers,
        urlGetAnswerData = params.urlGetAnswerData,
        countSwitchQuestions = 0,

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

    var sendToServer = function(jsonObj) {
        $.ajax({
            type: "POST",
            url: urlSendAnswers,
            data: JSON.stringify(jsonObj),
            dataType: "json",
            contentType: "application/json; charset=utf-8"
        });
    };

    //Удалить при переносе - информация, для внешнего контейнера о том, сколько осталось вопросов
    var updateInfo = function() {
        $('.js-poll-description').html(poll.data.poll.description);
        if (userInfo.get('done')) {
            $('.js-poll-question-remain').remove();
        } else {
            var questionRemain = questionsCollection.remaining().length;
            if (questionRemain === 0) {
                $('.js-change-info').html('Заполните форму');
            } else {
                var questionRemainText,
                    r10 = questionRemain % 10,
                    r100 = questionRemain % 100;
                if (r10 === 1 && r100 !== 11) {
                    questionRemainText = 'вопрос';
                } else if (r10 < 5 && r10 !== 0 && r100 !== 11 && r100 !== 12 && r100 !== 13 && r100 !== 14) {
                    questionRemainText = 'вопроса';
                } else {
                    questionRemainText = 'вопросов'
                }
                $('.js-question-remain-text').html(questionRemainText);
                $('.js-question-remain').html(questionRemain);
            }
        }
    };

    //Удалить при переносе
    var designDeformation = function() {
        if (poll.get('version') === 'desktop') {
            $('.poll-header').css('background-image', 'none');
            $('.poll-bg').css('background-image', 'url(' + poll.data.poll.background + ')');
            if (!questionsCollection.findWhere({active: true})) {
                $boxDetail.html('<img src="' + poll.data.poll.image + '" class="poll-present-img" />');
            }
        } else if (poll.get('version') === 'mobile') {
            $('.poll-bg').css('background-image', 'none');
            $('.poll-header').css('background-image', 'url(' + poll.data.poll.background + ')');
            $('.poll-present').html('<img src="' + poll.data.poll.image + '" class="poll-present-img" />');
        }
    };

    //Удалить при переносе
    var viewSponsor = function() {
        var sponsors = poll.data.poll.sponsors;
        if (sponsors.length > 0) {
            var currentSponsor = countSwitchQuestions % sponsors.length;
            $('.js-poll-sponsors').html('<a href="' + sponsors[currentSponsor].website + '" target="_blank"><img src="' + sponsors[currentSponsor].logo + '" /></a>');
        }
    };

    //Удалить при переносе
    var hideSponsor = function() {
        $('.js-poll-sponsors').html('');
    };


    //Класс, описывающий голосовалку
    models.Poll = Backbone.Model.extend({
        initialize: function() {
            var that = this;
            if (!that.get('status')) {
                that.set({status: 'created'});
            }
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
                determineVersion(that.model)
            }, 100));
        },

        render: function() {
            var currentModel = this.model;
            if (currentModel.get('status') === 'created') {

                var questionsCollectionView = new views.QuestionsCollectionView({ collection: questionsCollection });
                $boxList.html(questionsCollectionView.render());
                $(container).html($boxList);

                if (currentModel.get('version') === 'desktop') {
                    $(container).append($boxDetail);
                }

            } else if (currentModel.get('status') === 'loaded') {

                if (currentModel.get('version') === 'mobile') {
                    $(container).find($boxDetail).remove();
                } else if (currentModel.get('version') === 'desktop') {
                    $(container).append($boxDetail);
                }

                questionsCollection.forEach(function(question) {
                    if (question.get('active')) {
                        question.set({active: false});
                        question.set({active: true});
                    }
                }, this);

            } else if (currentModel.get('status') === 'answered') {
                var userInfoDetailView = new views.UserInfoDetailView({ model: userInfo });
                $(container).html(userInfoDetailView.render());

                hideSponsor();
            }

            if (currentModel.get('version') === 'mobile') {
                $('.poll-container').removeClass('desktop').addClass('mobile');

            } else if (currentModel.get('version') === 'desktop') {
                $('.poll-container').removeClass('mobile').addClass('desktop');

                if (!iScroll && $('.box-list').length) {
                    iScroll = new IScroll('.box-list', {
                        scrollbars: true,
                        mouseWheel: true,
                        click: true,
                        preventDefault: false,
                        bounce: false
                    });
                }
            }

            //Удалить при переносе
            updateInfo();
            designDeformation();
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

                    //Удалить при переносе - смена background
                    $('.poll-bg').css('background-image', 'url(' + currentModel.get('image') + ')');

                } else if (poll.get('version') === 'mobile') {
                    currentElement.append(questionDetailView.render());
                }

                var answer = currentModel.get('answer');
                if (currentModel.get('answered')) {
                    if (currentModel.get('type') === 'text') {
                        $('.js-field-answer').val(answer);
                    } else if (currentModel.get('type') === 'select') {
                        $('.js-selectize-poll').html('<option value="1">' + answer + '</option>');
                    }
                }

                //Инициализация Selectize
                if (currentModel.get('type') === 'select') {
                    initSelect(currentModel.get('answerDataType'));
                }

                if (currentModel.get('type') === 'text') {
                    $('.js-field-answer').focus();
                } else if (currentModel.get('type') === 'select') {
                    $('.selectize-input.items input').focus();
                }

                currentElement.addClass('active');

                viewSponsor();

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

            if (currentModel.get('active') || $(container).find('.selectize-input').hasClass('focus')) {
                return false;
            }

            questionsCollection.forEach(function(model) {
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

            countSwitchQuestions++;
        }
    });

    views.QuestionDetailView = Backbone.View.extend({
        tagName: 'div',
        className: 'question-detail',
        minNecessarySymbols: 1,

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
                    var currentAnswer = currentModel.get('answer');
                    var blankAnswers = blank.answers;
                    var sameBlankAnswer = _.findWhere(blankAnswers, {
                        questionID: currentModelID
                    });

                    if (sameBlankAnswer) {
                        sameBlankAnswer.value = currentAnswer;
                    } else {
                        var newAnswer = function(){
                            return {
                                "questionID": currentModelID,
                                "value": currentAnswer
                            };
                        };
                        blankAnswers.push(newAnswer());
                    }

                    var oneAnswerBlank = {
                        "voter": {
                            "sessionID": blank.voter.sessionID,
                            "pollID": blank.voter.pollID
                        },
                        "answer": {
                            "questionID": currentModelID,
                            "value": currentAnswer
                        }
                    };

                    //Отправляем один ответ на сервер
                    sendToServer(oneAnswerBlank);

                    //Удалить при переносе - информация, для внешнего контейнера о том, сколько осталось вопросов
                    updateInfo();

                    //Переключаемся на следующий вопрос
                    if (questionsCollection.remaining().length === 0) {
                        poll.set({status: 'answered'});
                        currentModel.set({active: false});
                        userInfo.set({active: true});

                        var userInfoDetailView = new views.UserInfoDetailView({ model: userInfo });
                        $(container).html(userInfoDetailView.render());

                        hideSponsor();
                    } else {
                        this.nextQuestion();
                    }
                }
            } else {
                var input;
                var errorBox = currentElement.find('.js-error-text');
                if (currentModel.get('type') === 'select') {
                    input = currentElement.find('.selectize-input');
                    input.addClass('error-input');
                    errorBox.html('Введите хотя бы 1 символ, чтобы получить список доступных ответов')
                } else {
                    input = currentElement.find('input.js-field-answer');
                    input.addClass('error-input');
                    errorBox.html('Введите ответ')
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

            currentModel.set({
                active: false,
                readyToAnswer: false
            });
            nextModel.set({active: true});

            countSwitchQuestions++;
        },

        readyToAnswer: function() {
            var currentModel = this.model;
            var currentElement = this.$el;
            var buttonAnswer = currentElement.find('.js-btn-answer');
            var answer;
            var input;
            var errorBox = currentElement.find('.js-error-text');

            if (currentModel.get('type') === 'select' && currentModel.get('active')) {
                input = currentElement.find('.selectize-input');

                if (input.hasClass('error-input')) {
                    input.removeClass('error-input');
                    errorBox.html('');
                }

                if (input.children().length > 1) {
                    answer = input.find('.item').html();
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
                    errorBox.html('');
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
            that.collection.forEach(function(question) {
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
            var currentElement = this.$el;
            var template = this.template(currentModel.toJSON());
            currentElement.html(template);

            if (currentModel.get('done')) {
                currentElement.addClass('answered');
            }

            if (currentModel.get('active')) {
                var userInfoDetailView = new views.UserInfoDetailView({ model: currentModel });
                $boxDetail.html(userInfoDetailView.render());
                currentElement.addClass('active');
            } else {
                currentElement.removeClass('active');
            }

            return this.el;
        },

        events: {
            'click' : 'clickHandle'
        },

        clickHandle: function() {
            var that = this;

            questionsCollection.forEach(function(question) {
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

            //Удалить при переносе
            designDeformation();

            return this.el;
        },

        events: {
            'click .js-btn-answer': 'submitData'
        },

        submitData: function(event) {
            var e = event || false;
            if (e) {
                e.stopImmediatePropagation();
                e.preventDefault();
            }

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

                var agreeParticipation = function() {
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
                    active: false,
                    done: true,
                    name: firstName,
                    lastName: lastName,
                    email: email,
                    phone: phone,
                    agreeParticipation: agreeParticipation(),
                    agreePolicy: agreePolicy(),
                    agreeNews: agreeNews()
                });

                //Обновляем данные в "слепке"
                _.extend(blank.voter, currentModel.attributes);

                //Отправляем "слепок" на сервер
                sendToServer(blank);
                poll.set({status: 'submitted'});

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
    var questionsCollection;
    var questionsCollectionView;

    var $boxList = $('<div class="box-list"></div>');
    var $boxDetail = $('<div class="box-detail"></div>');
    //Создаем объект, хранящий информацию, которую нужно будет отправлять
    var blank;
    //Переменная для iScroll
    var iScroll;


    $.when(
        //Запрос данных
        $.getJSON(urlGetPoll, function(data) {
            poll.data = data;
        })
    ).then(function() {

            //Запрос данных, которые пользователь уже ввел в рамках текущей сессии
            blank = poll.data.result;

            if (!blank.answers) {
                blank.answers = [];
            }

            if (!blank.voter.pollID) {
                blank.voter.pollID = poll.data.poll.id;
            }

            //Заполнение коллекции
            questionsCollection = new collections.QuestionsCollection(poll.data.poll.questions, function(model) {return model.get('number');});

            //Сортировка коллекции по полю "number"
            //questionsCollection.comparator = function(model) {
            //    return model.get('number');
            //};
            //questionsCollection.sort();

            //У каждой модели коллекции обновляем поле ответа с помощью данных, которые содержатся в "слепке"
            questionsCollection.forEach(function(model) {
                var currentModelID = model.get('id');
                var sameBlankAnswer = _.findWhere(blank.answers, {
                    questionID: currentModelID
                });

                if (sameBlankAnswer) {
                    model.set({
                        answer: sameBlankAnswer.value,
                        answered: true
                    });
                }

                //$.ajax({
                //    url: model.get('image'),
                //    type: 'GET',
                //    error: function () {
                //        console.log("Что-то пошло не так в модуле голосования при ajax-загрузке картинки для вопроса");
                //    }
                //});
            });

            questionsCollectionView = new views.QuestionsCollectionView({ collection: questionsCollection });

            //Обновляем данные о пользователе с помощью данных, которые содержатся в "слепке"
            _.extend(userInfo.attributes, blank.voter);

            if (questionsCollection.remaining().length === 0) {
                poll.set({status: 'answered'});
            }

            //Отрисовываем всю коллекцию через отрисовку глобальной модели
            pollView.render();

            //Меняем статус глобальной модели
            if (poll.get('status') === 'created') {
                poll.set({status: 'loaded'});
            }

            //Если canVote === false, тогда пользователь не может голосовать
            if (blank.voter.canVote === false) {
                poll.set({status: 'submitted'});
                userInfo.set({
                    done: true,
                    active: true
                });

                var userInfoDetailView = new views.UserInfoDetailView({ model: userInfo });
                $(container).html(userInfoDetailView.render());
            }

            //Удалить при переносе - информация, для внешнего контейнера о том, сколько осталось вопросов
            updateInfo();

        }, function() {
            console.log("Как минимум один из ajax-запросов выполнен неуспешно");
        });


    //Инициализация Selectize
    var initSelect = function(answerDataType) {
        var $select = $('.js-selectize-poll').selectize({
            valueField: 'id',
            labelField: 'text',
            searchField: 'text',
            sortField: 'id',
            //preload: true,  //предварительная загрузка, когда ничего не введено в поле
            create: false,
            highlight: false,
            render: {
                option: function(item, escape) {
                    return '<div>'+ escape(item.text) +'</div>';
                }
            },

            load: function(query, callback) {
                if (query.length >= 1) {
                    NProgress.start();
                    this.clearOptions();
                    this.renderCache = {};
                    $.ajax({
                        url: urlGetAnswerData,
                        type: 'GET',
                        dataType: 'json',
                        data: {
                            type: answerDataType,
                            q: query
                        },
                        error: function () {
                            callback();
                            console.log("Ошибка загрузки данных для вопроса");
                            NProgress.done();
                        },
                        success: function (res) {
                            if (res.options.length === 0) {
                                $('.js-error-text').html('Такого варианта ответа нет. Введите другой.');
                                $('.selectize-input').addClass('error-input');
                            } else {
                                callback(res.options);
                            }
                            NProgress.done();
                        }
                    });
                }
            }
        });
    };
};
