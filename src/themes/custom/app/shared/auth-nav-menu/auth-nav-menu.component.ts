import { Component, OnInit } from '@angular/core';
import {
  AuthNavMenuComponent as BaseComponent,
} from '../../../../../app/shared/auth-nav-menu/auth-nav-menu.component';
import { fadeInOut, fadeOut } from '../../../../../app/shared/animations/fade';
import { HALEndpointService } from '../../../../../app/core/shared/hal-endpoint.service';
import { HostWindowService } from '../../../../../app/shared/host-window.service';
import { Store } from '@ngrx/store';
import { AppState } from '../../../../../app/app.reducer';
import { AuthService } from '../../../../../app/core/auth/auth.service';

@Component({
  selector: 'ds-auth-nav-menu',
  templateUrl: './auth-nav-menu.component.html',
  styleUrls: ['../../../../../app/shared/auth-nav-menu/auth-nav-menu.component.scss'],
  animations: [fadeInOut, fadeOut]
})
export class AuthNavMenuComponent extends BaseComponent implements OnInit {

  private repositoryPath = '';

  constructor(
    store: Store<AppState>,
    windowService: HostWindowService,
    authService: AuthService,
    private halService: HALEndpointService,
  ) {
    super(store, windowService, authService);
  }

  ngOnInit(): void {
    super.ngOnInit();
    this.repositoryPath = this.halService.getRootHref();
  }

  redirectToDiscovery() {
    const host = window.location.origin;
    const repoPath = this.repositoryPath.endsWith('/') ? this.repositoryPath : this.repositoryPath + '/';
    const target = repoPath + 'authn/shibboleth?redirectUrl=' + encodeURIComponent(window.location.href);
    const returnUrl = host + '/Shibboleth.sso/Login?SAMLDS=1&target=' + encodeURIComponent(target);
    const entityID = host + '/shibboleth';
    window.location.href = 'https://discovery.clarin.eu/?entityID='
      + encodeURIComponent(entityID) + '&return=' + encodeURIComponent(returnUrl);
  }
}
