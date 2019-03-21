angular.module('portainer.docker')
.controller('NetworkController', ['$scope', '$state', '$transition$', '$filter', 'NetworkService', 'Container', 'Notifications', 'HttpRequestHelper', 'PREDEFINED_NETWORKS',
function ($scope, $state, $transition$, $filter, NetworkService, Container, Notifications, HttpRequestHelper, PREDEFINED_NETWORKS) {

  $scope.network = {};

  $scope.removeNetwork = function removeNetwork() {
    NetworkService.remove($transition$.params().id, $transition$.params().id)
    .then(function success() {
      Notifications.success('Network removed', $transition$.params().id);
      $state.go('docker.networks', {});
    })
    .catch(function error(err) {
      Notifications.error('Failure', err, 'Unable to remove network');
    });
  };

  $scope.containerLeaveNetwork = function containerLeaveNetwork(network, container) {
    HttpRequestHelper.setPortainerAgentTargetHeader(container.NodeName);
    NetworkService.disconnectContainer($transition$.params().id, container.Id, false)
    .then(function success() {
      Notifications.success('Container left network', $transition$.params().id);
      $state.go('docker.networks.network', { id: network.Id }, { reload: true });
    })
    .catch(function error(err) {
      Notifications.error('Failure', err, 'Unable to disconnect container from network');
    });
  };

  $scope.allowRemove = function allowRemove(item) {
    return !PREDEFINED_NETWORKS.includes(item.Name);
  };

  function filterContainersInNetwork(network, containers) {
    var containersInNetwork = [];
    containers.forEach(function(container) {
      var containerInNetwork = network.Containers[container.Id];
      if (containerInNetwork) {
        containerInNetwork.Id = container.Id;
        // Name is not available in Docker 1.9
        if (!containerInNetwork.Name) {
          containerInNetwork.Name = $filter('trimcontainername')(container.Names[0]);
        }
        containersInNetwork.push(containerInNetwork);
      }
    });
    $scope.containersInNetwork = containersInNetwork;
  }

  function getContainersInNetwork(network) {
    var apiVersion = $scope.applicationState.endpoint.apiVersion;
    if (network.Containers) {
      if (apiVersion < 1.24) {
        Container.query({}, function success(data) {
          var containersInNetwork = data.filter(function filter(container) {
            if (container.HostConfig.NetworkMode === network.Name) {
              return container;
            }
          });
          filterContainersInNetwork(network, containersInNetwork);
        }, function error(err) {
          Notifications.error('Failure', err, 'Unable to retrieve containers in network');
        });
      } else {
        Container.query({
          filters: { network: [$transition$.params().id] }
        }, function success(data) {
          filterContainersInNetwork(network, data);
        }, function error(err) {
          Notifications.error('Failure', err, 'Unable to retrieve containers in network');
        });
      }
    }
  }

  function initView() {
    var nodeName = $transition$.params().nodeName;
    HttpRequestHelper.setPortainerAgentTargetHeader(nodeName);
    $scope.nodeName = nodeName;
    NetworkService.network($transition$.params().id)
    .then(function success(data) {
      $scope.network = data;
      var endpointProvider = $scope.applicationState.endpoint.mode.provider;
      if (endpointProvider !== 'VMWARE_VIC') {
        getContainersInNetwork(data);
      }
    })
    .catch(function error(err) {
      Notifications.error('Failure', err, 'Unable to retrieve network info');
    });
  }

  initView();
}]);
