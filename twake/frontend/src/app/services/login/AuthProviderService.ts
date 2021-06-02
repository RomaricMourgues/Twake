import Oidc from 'oidc-client';
import { AuthProviderProps } from 'oidc-react';
import environment from '../../environment/environment';
import Api from '../Api';
import InitService from '../InitService';
import JWTStorage, { JWTDataType } from '../JWTStorage';
import Observable from '../Observable/Observable';
import LoginService from './login';

type AuthProviderConfiguration = AuthProviderProps;

class AuthProviderService extends Observable {
  private authProviderUserManager: Oidc.UserManager | null = null;

  getAuthProviderConfiguration(): AuthProviderConfiguration {
    const consoleConfiguration = InitService.server_infos?.configuration.accounts.console;

    if (!this.authProviderUserManager) {
      this.authProviderUserManager = new Oidc.UserManager({
        authority: consoleConfiguration?.authority || environment.api_root_url,
        client_id: consoleConfiguration?.client_id || 'twake',
        redirect_uri: environment.front_root_url + '/oidccallback',
        response_type: 'code',
        scope: 'openid profile email address phone offline_access',
        post_logout_redirect_uri: environment.front_root_url + '/logout',
        silent_redirect_uri: environment.front_root_url + '/silientrenew',
        automaticSilentRenew: true,
        loadUserInfo: true,
        accessTokenExpiringNotificationTime: 60,
        filterProtocolClaims: true,
      });

      Oidc.Log.logger = console;
      Oidc.Log.level = Oidc.Log.INFO;

      this.authProviderUserManager.events.addUserLoaded(async user => {
        console.log('User loaded');
        const response = (await Api.post('users/console/token', {
          access_token: user.access_token,
        })) as { access_token: JWTDataType };
        JWTStorage.updateJWT(response.access_token);
        LoginService.updateUser(() => {});
      });

      this.authProviderUserManager.events.addAccessTokenExpiring(() => {
        console.log('AccessToken Expiring');
      });

      this.authProviderUserManager.events.addUserSignedOut(() => {
        console.log('Signed out');
        if (this.authProviderUserManager)
          this.authProviderUserManager
            .signoutRedirect()
            .then(function (resp) {
              JWTStorage.clear();
              window.location.reload();
            })
            .catch(function (err) {
              console.log(err);
            });
      });

      this.authProviderUserManager.events.addUserSignedIn(() => {
        console.log('Signed in');
      });

      this.authProviderUserManager.events.addAccessTokenExpired(() => {
        console.log('AccessToken Expired');
      });

      this.authProviderUserManager.events.addSilentRenewError(error => {
        console.error('Silent Renew Error', error);
      });
    }

    return {
      userManager: this.authProviderUserManager,
    };
  }
}

export default new AuthProviderService();
