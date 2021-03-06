import Login from 'services/login/login.js';
import Collections from 'app/services/Depreciated/Collections/Collections.js';
import Api from 'services/Api';
import ws from 'services/websocket.js';
import Observable from 'app/services/Depreciated/observable.js';
import SecuredConnection from 'app/services/Depreciated/Collections/SecuredConnection.js';
import Number from 'services/utils/Numbers.js';
import ConfiguratorsManager from 'services/Configurators/ConfiguratorsManager.js';
import AlertManager from 'services/AlertManager/AlertManager';
import Languages from 'services/languages/languages.js';
import $ from 'jquery';
import JWTStorage from 'services/JWTStorage';

import Globals from 'services/Globals.js';

class CurrentUser extends Observable {
  constructor() {
    super();
    this.setObservableName('currentUserService');
    this.loading = false;
    this.errorUsernameExist = false;
    this.errorUnkown = false;
    this.errorBadImage = false;

    this.unique_connection_id = Number.unid();

    Globals.window.currentUser = this;
  }

  start() {
    //This connexion will be used for crypted personnal events like apps configurators
    this.updates_connection = new SecuredConnection(
      'updates/' + Login.currentUserId,
      { type: 'updates' },
      (type, data) => {
        if (type == 'event' && data.action == 'configure') {
          if (data.connection_id == this.unique_connection_id) {
            ConfiguratorsManager.openConfigurator(data.application, data.form, data.hidden_data);
          }
        }
        if (type == 'event' && data.action == 'close_configure') {
          if (data.connection_id == this.unique_connection_id) {
            ConfiguratorsManager.closeConfigurator(data.application);
          }
        }
      },
    );
  }

  get() {
    return Collections.get('users').find(Login.currentUserId);
  }

  updateStatusIcon(status) {
    var data = {
      status: status,
    };
    var update = {
      id: Login.currentUserId,
      status_icon: status,
    };
    Collections.get('users').updateObject(update);
    Api.post('users/account/update_status', data, res => {
      ws.publish('users/' + Login.currentUserId, { user: update });
    });
  }

  updateTutorialStatus(key, set_false) {
    var user = this.get();
    if (!user) {
      return;
    }
    if (!user.tutorial_status || user.tutorial_status.length == 0) {
      user.tutorial_status = {};
    }
    if (user.tutorial_status[key] == (set_false ? false : true)) {
      return;
    }
    user.tutorial_status[key] = set_false ? false : true;
    Collections.get('users').updateObject(this.get());

    var data = {
      status: user.tutorial_status,
    };
    Api.post('users/account/set_tutorial_status', data, res => {
      ws.publish('users/' + Login.currentUserId, {
        user: { tutorial_status: user.tutorial_status },
      });
    });
  }

  updateUserName(username) {
    var that = this;
    var update = {
      id: Login.currentUserId,
      username: username,
    };
    Collections.get('users').updateObject(update);
    that.loading = true;
    that.notify();
    Api.post('users/account/username', { username: username }, res => {
      that.loading = false;
      if (res.errors.length == 0) {
        ws.publish('users/' + Login.currentUserId, { user: update });
        that.errorUsernameExist = false;
      } else {
        that.errorUsernameExist = true;
      }
      that.notify();
    });
  }

  updateidentity(l, f, t) {
    this.loading = true;
    this.notify();

    var route = Globals.window.api_root_url + '/ajax/' + 'users/account/identity';

    var data = new FormData();
    if (t !== false) {
      data.append('thumbnail', t);
    }
    if (f) {
      data.append('firstname', f);
    } else {
      data.append('firstname', '');
    }
    if (l) {
      data.append('lastname', l);
    } else {
      data.append('lastname', '');
    }

    this.updateTutorialStatus('has_identity');

    var that = this;

    $.ajax({
      url: route,
      type: 'POST',
      data: data,
      cache: false,
      contentType: false,
      processData: false,
      xhrFields: {
        withCredentials: true,
      },
      headers: {
        Authorization: JWTStorage.getAutorizationHeader(),
      },
      xhr: function () {
        var myXhr = $.ajaxSettings.xhr();
        myXhr.onreadystatechange = function () {
          if (myXhr.readyState == XMLHttpRequest.DONE) {
            that.loading = false;
            var resp = JSON.parse(myXhr.responseText);
            if (resp.errors.indexOf('badimage') > -1) {
              that.error_identity_badimage = true;
              that.notify();
            } else {
              var update = {
                id: Login.currentUserId,
                firstname: f,
                lastname: l,
              };
              if (t !== false) {
                update.thumbnail = resp.data.thumbnail || '';
              }
              Collections.get('users').updateObject(update);
              ws.publish('users/' + Login.currentUserId, { user: update });
              that.notify();
            }
          }
        };
        return myXhr;
      },
    });
  }

  updatePassword(oldPassword, password, password1) {
    oldPassword = oldPassword || '';
    password = password || '';
    password1 = password1 || '';
    if (password != password1 || password.length < 8) {
      this.badNewPassword = true;
      this.notify();
      return;
    }
    var that = this;
    that.loading = true;
    that.notify();
    Api.post('users/account/password', { old_password: oldPassword, password: password }, res => {
      that.loading = false;
      if (res.errors.length == 0) {
        that.badNewPassword = false;
        that.badOldPassword = false;

        AlertManager.alert(() => {}, {
          text: Languages.t(
            'services.user.update_password_alert',
            [],
            'Votre mot de passe a été mis à jour.',
          ),
        });
      } else {
        that.badNewPassword = false;
        that.badOldPassword = true;
      }
      that.notify();
    });
  }

  addNewMail(mail, cb, thot) {
    var that = this;
    that.loading = true;
    that.error_secondary_mail_already = false;
    that.error_code = false;
    that.notify();
    Api.post('users/account/addmail', { mail: mail }, function (res) {
      that.loading = false;

      if (res.errors.indexOf('badmail') > -1) {
        that.error_secondary_mail_already = true;
        that.notify();
      } else {
        that.addmail_token = res.data.token;
        that.notify();
        cb(thot);
      }
    });
  }

  makeMainMail(mailId) {
    var that = this;
    that.loading = true;
    that.notify();
    Api.post('users/account/mainmail', { mail: mailId }, res => {
      if (res.errors.length == 0) {
        var mails = Collections.get('users').find(Login.currentUserId).mails;
        for (var i = 0; i < mails.length; i++) {
          mails[i].main = false;
          if (mails[i].id == mailId) {
            mails[i].main = true;
          }
        }
        var update = {
          id: Login.currentUserId,
          mails: mails,
        };
        Collections.get('users').updateObject(update);
      }
      that.loading = false;
      that.notify();
    });
  }
  removeMail(mailId) {
    var that = this;
    that.loading = true;
    that.notify();
    Api.post('users/account/removemail', { mail: mailId }, res => {
      if (res.errors.length == 0) {
        var mails = Collections.get('users').find(Login.currentUserId).mails;
        var newMails = [];
        for (var i = 0; i < mails.length; i++) {
          if (mails[i].id != mailId) {
            newMails.push(mails[i]);
          }
        }
        var update = {
          id: Login.currentUserId,
          mails: newMails,
        };
        Collections.get('users').updateObject(update);
      }
      that.loading = false;
      that.notify();
    });
  }
}

const service = new CurrentUser();
export default service;
