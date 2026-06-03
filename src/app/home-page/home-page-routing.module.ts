import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

import { ThemedHomePageComponent } from './themed-home-page.component';

@NgModule({
  imports: [
    RouterModule.forChild([
      {
        path: '',
        component: ThemedHomePageComponent,
        pathMatch: 'full',
        data: {
          title: 'home.title',
          // statistics_site removed — site_stats in menu.resolver.ts handles this without auth-gating
        }
      }
    ])
  ]
})
export class HomePageRoutingModule {
}
