import { Component, OnInit } from '@angular/core';
import { AuthService } from '../core/auth/auth.service';
import { take } from 'rxjs/operators';
import { EPerson } from '../core/eperson/models/eperson.model';
import { HALEndpointService } from '../core/shared/hal-endpoint.service';
import { LocaleService } from '../core/locale/locale.service';

/**
 * The component which wraps `language` and `login`/`logout + profile` operations in the top navbar.
 */
@Component({
  selector: 'ds-clarin-navbar-top',
  templateUrl: './clarin-navbar-top.component.html',
  styleUrls: ['./clarin-navbar-top.component.scss']
})
export class ClarinNavbarTopComponent implements OnInit {

  constructor(private authService: AuthService,
              private halService: HALEndpointService,
              private localeService: LocaleService) { }

  /**
   * The current authenticated user. It is null if the user is not authenticated.
   */
  authenticatedUser = null;

  /**
   * The server path e.g., `http://localhost:8080/server/api/`
   */
  repositoryPath = '';

  ngOnInit(): void {
    let authenticated = false;
    this.loadRepositoryPath();
    this.authService.isAuthenticated()
      .pipe(take(1))
      .subscribe( auth => {
      authenticated = auth;
    });

    if (authenticated) {
      this.authService.getAuthenticatedUserFromStore().subscribe((user: EPerson) => {
        this.authenticatedUser = user;
      });
    } else {
      this.authenticatedUser = null;
    }
  }

  redirectToDiscovery() {
    const host = window.location.origin;
    const repoPath = this.repositoryPath.endsWith('/') ? this.repositoryPath : this.repositoryPath + '/';
    const target = repoPath + 'authn/shibboleth?redirectUrl='
      + encodeURIComponent(window.location.href);
    const returnUrl = host + '/Shibboleth.sso/Login?SAMLDS=1&target='
      + encodeURIComponent(target);
    const entityID = host + '/shibboleth';
    window.location.href = 'https://discovery.clarin.eu/?entityID='
      + encodeURIComponent(entityID) + '&return=' + encodeURIComponent(returnUrl);
  }

  private loadRepositoryPath() {
    this.repositoryPath = this.halService.getRootHref();
  }

  setLanguage(language) {
    this.localeService.setCurrentLanguageCode(language);
    this.localeService.refreshAfterChangeLanguage();
  }
}
