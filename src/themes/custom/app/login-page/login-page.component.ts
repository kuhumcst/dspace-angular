import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Store } from '@ngrx/store';
import { take } from 'rxjs/operators';

import { LoginPageComponent as BaseComponent } from '../../../../app/login-page/login-page.component';
import { AppState } from '../../../../app/app.reducer';
import { AuthService } from '../../../../app/core/auth/auth.service';
import { HALEndpointService } from '../../../../app/core/shared/hal-endpoint.service';
import { getRedirectUrl } from '../../../../app/core/auth/selectors';

@Component({
  selector: 'ds-login-page',
  styleUrls: ['../../../../app/login-page/login-page.component.scss'],
  templateUrl: './login-page.component.html'
})
export class LoginPageComponent extends BaseComponent implements OnInit {

  private repositoryPath = '';

  constructor(
    route: ActivatedRoute,
    store: Store<AppState>,
    authService: AuthService,
    private halService: HALEndpointService,
    // Re-injected under a different name because the base class declares `store` as private,
    // making it inaccessible to subclasses despite TypeScript inheritance.
    private authStore: Store<AppState>,
  ) {
    super(route, store, authService);
  }

  ngOnInit(): void {
    super.ngOnInit();
    this.repositoryPath = this.halService.getRootHref();
  }

  redirectToDiscovery() {
    const host = window.location.origin;
    const repoPath = this.repositoryPath.endsWith('/') ? this.repositoryPath : this.repositoryPath + '/';

    // Use the originally requested URL from the auth store if available,
    // otherwise fall back to the current page so Shibboleth returns here.
    this.authStore.select(getRedirectUrl).pipe(take(1)).subscribe((redirectUrl: string) => {
      const destination = redirectUrl ? host + redirectUrl : window.location.href;
      const target = repoPath + 'authn/shibboleth?redirectUrl=' + encodeURIComponent(destination);
      const returnUrl = host + '/Shibboleth.sso/Login?SAMLDS=1&target=' + encodeURIComponent(target);
      const entityID = host + '/shibboleth';
      window.location.href = 'https://discovery.clarin.eu/?entityID='
        + encodeURIComponent(entityID) + '&return=' + encodeURIComponent(returnUrl);
    });
  }
}
