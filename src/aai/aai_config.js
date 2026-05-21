/*global jQuery */
/*jshint globalstrict: true*/
'use strict';

jQuery(document).ready(
    function () {
        var opts = (function () {
            var instance = {};
            //if ever port is needed (eg. testing other tomcat) it should be in responseUrl and target
            instance.port = (window.location.port === "" ? "" : ":" + window.location.port);
            instance.host = window.location.protocol + '//' +
                window.location.hostname;
            instance.repoPath = jQuery("a#repository_path").attr("href");
            if (instance.repoPath.charAt(instance.repoPath.length - 1) !== '/') {
                instance.repoPath = instance.repoPath + '/';
            }
            instance.target = instance.repoPath;

            //In order to use the discojuice store (improve score of used IDPs)
            instance.responseUrl = instance.host + instance.port + "/assets/disco-juice.html?";
            instance.metadataFeed = instance.target + "discojuice/feeds";
            instance.serviceName = "CLARIN-DK Repository";
            // Federated authentication only - no local accounts
            instance.localauth = '';
            instance.target = instance.target + "authn/shibboleth";
            return instance;
        })();
        if (!("aai" in window)) {
            throw "Failed to find UFAL AAI object. See https://redmine.ms.mff.cuni.cz/projects/lindat-aai for more details!";
        }
        window.aai.setup(opts);
    }
); // ready
